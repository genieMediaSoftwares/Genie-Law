import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';

import { apiClient, isApiUrl } from '../api/apiClient';
import { tokenStore } from '../api/tokenStore';
import i18n from '../i18n';

// Opens a protected document (PDF, image, Word…) on iOS/Android.
//
// Phones cannot show a PDF inside the app's views, so the file is downloaded
// (with the signed-in user's token) into the app cache and handed to the
// device: Android's "Open with" viewer, or the iOS preview/share sheet.
// The web build uses documentOpener.web.ts instead.

export interface OpenableDocument {
  url: string;
  fileName: string;
  mimeType: string;
}

const safeName = (name: string): string =>
  (name || 'document').replace(/[^\w.-]+/g, '_').slice(-80) || 'document';

// Downloaded copies are legal documents in plain form. Each is kept only long
// enough for the viewer app to read it, and all of them go at sign-out.
const VIEWER_FOLDER = 'document-viewer';
const KEEP_OPENED_COPY_MS = 60 * 60 * 1000;

const viewerFolder = (): Directory => new Directory(Paths.cache, VIEWER_FOLDER);

const pruneOpenedCopies = (folder: Directory): void => {
  const cutoff = Date.now() - KEEP_OPENED_COPY_MS;
  for (const entry of folder.list()) {
    try {
      if (!(entry instanceof File) || (entry.modificationTime ?? 0) < cutoff) {
        entry.delete();
      }
    } catch {
      // Still held by a viewer; the next pass or sign-out removes it.
    }
  }
};

// Removes every downloaded copy (sign-out, session expiry).
export function clearOpenedDocuments(): void {
  try {
    const folder = viewerFolder();
    if (folder.exists) {
      folder.delete();
    }
  } catch {
    // Nothing to remove, or the OS is clearing the cache itself.
  }
}

export async function openDocumentOnDevice(doc: OpenableDocument): Promise<void> {
  // A cheap authenticated request first: if the access token has expired the
  // API client refreshes it, so the download below carries a valid token.
  await apiClient.head(doc.url);

  const token = isApiUrl(doc.url) ? tokenStore.getAccessToken() : null;
  const folder = viewerFolder();
  folder.create({ intermediates: true, idempotent: true });
  pruneOpenedCopies(folder);
  const target = new File(folder, `${Date.now()}-${safeName(doc.fileName)}`);

  const file = await File.downloadFileAsync(doc.url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: file.contentUri,
        type: doc.mimeType || '*/*',
        // FLAG_GRANT_READ_URI_PERMISSION: let the viewer app read our file.
        flags: 1,
      });
      return;
    } catch {
      // No app registered for this type: fall back to the share sheet.
    }
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(i18n.t('documents:files.noAppToOpen'));
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: doc.mimeType || undefined,
    UTI: doc.mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    dialogTitle: doc.fileName,
  });
}
