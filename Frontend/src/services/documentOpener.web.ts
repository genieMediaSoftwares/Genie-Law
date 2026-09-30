import i18n from '../i18n';
// The web build shows documents inside the viewer (iframe/image/preview), so
// it never needs the device opener. Kept so imports resolve on web.

export interface OpenableDocument {
  url: string;
  fileName: string;
  mimeType: string;
}

// Nothing is downloaded on web.
export function clearOpenedDocuments(): void {}

export async function openDocumentOnDevice(_doc: OpenableDocument): Promise<void> {
  throw new Error(i18n.t('documents:files.openOnlyNative'));
}
