import i18n from '../i18n';
import { localeFor } from '../i18n/config';

// Dates and numbers use the current language's locale (en-IN / hi-IN / te-IN).
const locale = (): string => localeFor(i18n.language);

const parse = (value?: string | number | Date | null): Date | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: string | number | Date | null): string => {
  const date = parse(value);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (
  value?: string | number | Date | null,
): string => {
  const date = parse(value);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const formatRelative = (
  value?: string | number | Date | null,
): string => {
  const date = parse(value);
  if (!date) {
    return '';
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return i18n.t('common:time.justNow');
  }
  if (seconds < 3600) {
    return i18n.t('common:time.minutesAgo', { count: Math.floor(seconds / 60) });
  }
  if (seconds < 86400) {
    return i18n.t('common:time.hoursAgo', { count: Math.floor(seconds / 3600) });
  }
  if (seconds < 604800) {
    return i18n.t('common:time.daysAgo', { count: Math.floor(seconds / 86400) });
  }

  return formatDate(date);
};

export const formatFee = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }

  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatRating = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }
  return value.toFixed(1);
};

export const formatExperience = (years?: number | null): string => {
  if (typeof years !== 'number' || !Number.isFinite(years) || years <= 0) {
    return '';
  }
  return i18n.t('common:time.years', { count: years });
};

export const truncate = (value: string, max: number): string => {
  const text = String(value || '').trim();
  if (text.length <= max) {
    return text;
  }

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

export const formatFileSize = (bytes?: number | string | null): string => {
  if (typeof bytes === 'string') return bytes;
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Any Intl date format in the current language, e.g. { weekday: 'short' }.
export const formatDateParts = (
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string => {
  const date = parse(value);
  return date ? new Intl.DateTimeFormat(locale(), options).format(date) : '';
};
