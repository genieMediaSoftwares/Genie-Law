import { env } from '../config/env';

const fileOrigin = (): string => env.apiBaseUrl.replace(/\/api\/?$/i, '');

export const resolveFileUrl = (value?: string | null): string | null => {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return null;
  }

  if (raw.startsWith('data:')) {
    return raw;
  }

  const origin = fileOrigin();

  const uploadsIndex = raw.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    const uploadPath = raw.slice(uploadsIndex);
    return `${origin}${uploadPath}`;
  }

  if (raw.startsWith('uploads/')) {
    return `${origin}/${raw}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/([^:])\/{2,}/g, '$1/');
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${origin}${path}`;
};

export const getUploadUrl = resolveFileUrl;

export const isOwnUpload = (url: string): boolean =>
  url.startsWith(`${fileOrigin()}/uploads/`) && !url.includes('/../');

export const isPublicUpload = (value?: string | null): boolean =>
  /\/uploads\/profiles\//i.test(String(value ?? ''));

export const formatFileSize = (size?: string | number | null): string => {
  if (size === null || size === undefined || size === '') {
    return '';
  }

  const asNumber = typeof size === 'number' ? size : Number(String(size).trim());

  if (!Number.isFinite(asNumber)) {
    return String(size);
  }

  if (asNumber < 1024) {
    return `${asNumber} B`;
  }
  if (asNumber < 1024 * 1024) {
    return `${(asNumber / 1024).toFixed(0)} KB`;
  }
  return `${(asNumber / (1024 * 1024)).toFixed(1)} MB`;
};
