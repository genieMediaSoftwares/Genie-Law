import { formatDate } from '../../utils/format';
import { formatFileSize } from '../../utils/urls';
import type { AppDocument } from '../../types/domain';
import i18n from '../../i18n';

export interface DocumentBadgeInfo {
  ext: string;
  category: 'pdf' | 'docx' | 'image' | 'text' | 'other';
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const getDocumentBadgeInfo = (doc: AppDocument): DocumentBadgeInfo => {
  const fileName = doc.name || doc.originalName || doc.fileName || '';
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  const ext = match ? match[1].toLowerCase() : '';
  const mime = (doc.mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) {
    return {
      ext: 'pdf',
      category: 'pdf',
      bgColor: 'bg-error-surface',
      textColor: 'text-error',
      borderColor: 'border-error',
    };
  }

  if (ext === 'docx' || ext === 'doc' || mime.includes('word') || mime.includes('officedocument')) {
    return {
      ext: ext || 'doc',
      category: 'docx',
      bgColor: 'bg-info-surface',
      textColor: 'text-info',
      borderColor: 'border-info',
    };
  }

  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mime.startsWith('image/')) {
    return {
      ext: ext || 'img',
      category: 'image',
      bgColor: 'bg-success-surface',
      textColor: 'text-success',
      borderColor: 'border-success',
    };
  }

  if (['txt', 'md', 'csv'].includes(ext) || mime.startsWith('text/')) {
    return {
      ext: ext || 'txt',
      category: 'text',
      bgColor: 'bg-surface-alt',
      textColor: 'text-secondary',
      borderColor: 'border-border',
    };
  }

  return {
    ext: ext || 'file',
    category: 'other',
    bgColor: 'bg-surface-alt',
    textColor: 'text-secondary',
    borderColor: 'border-border',
  };
};

export const formatDocumentMeta = (doc: AppDocument): string => {
  const sizeStr = formatFileSize(doc.fileSize) || i18n.t('documents:unknownSize');
  const dateStr = formatDate(doc.uploadedAt || doc.createdAt) || '';
  return dateStr ? `${sizeStr} • ${dateStr}` : sizeStr;
};
