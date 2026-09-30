import { Alert, Platform } from 'react-native';

import { MAX_DOCUMENT_SIZE } from '../api/aiApi';
import type { PickedFile } from '../types/ai';
import i18n from '../i18n';

export const exceedsDocumentLimit = (size: number | null | undefined): boolean =>
  typeof size === 'number' && size > MAX_DOCUMENT_SIZE;

export const showFileTooLargeAlert = (): void => {
  Alert.alert(
    i18n.t('documents:size.tooLargeTitle'),
    i18n.t('documents:size.tooLargeMessage'),
    [{ text: i18n.t('documents:size.chooseAnotherFile') }],
  );
};

// The picker's reported size when present, otherwise the bytes actually read.
export const readActualSize = async (file: PickedFile): Promise<number | null> => {
  if (typeof file.size === 'number' && Number.isFinite(file.size)) {
    return file.size;
  }
  if (Platform.OS === 'web') {
    const blob = file.file as { size?: number } | undefined;
    return typeof blob?.size === 'number' ? blob.size : null;
  }
  try {
    const response = await fetch(file.uri);
    return (await response.blob()).size;
  } catch {
    return null;
  }
};

export interface SizeCheckResult {
  accepted: PickedFile[];
  oversized: PickedFile[];
}

// Runs right after picking, before any upload, optimization or AI call.
// Each file is checked on its own, so valid files in the same pick are kept.
// Shows the "File Too Large" alert once if anything was rejected.
export async function rejectOversizedDocuments(files: PickedFile[]): Promise<SizeCheckResult> {
  const accepted: PickedFile[] = [];
  const oversized: PickedFile[] = [];

  for (const file of files) {
    const size = await readActualSize(file);
    if (exceedsDocumentLimit(size)) {
      oversized.push(file);
    } else {
      accepted.push(size === null || size === file.size ? file : { ...file, size });
    }
  }

  if (oversized.length > 0) {
    showFileTooLargeAlert();
  }

  return { accepted, oversized };
}
