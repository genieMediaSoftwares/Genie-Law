// Languages the app ships with, and how they are stored and detected.
// To add a language: add it here, add src/i18n/locales/<code>/*.json with
// the same keys as English, and register it in src/i18n/resources.ts.

export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', englishName: 'English', locale: 'en-IN' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', locale: 'hi-IN' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', locale: 'te-IN' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

// AsyncStorage key for the language the user picked in Settings → Language.
export const LANGUAGE_STORAGE_KEY = 'genie_law_language';

// One file per area of the app (src/i18n/locales/<lang>/<namespace>.json).
export const NAMESPACES = [
  'common',
  'auth',
  'home',
  'profile',
  'cases',
  'documents',
  'notifications',
  'settings',
  'lawyer',
  'client',
  'assistant',
  'payments',
  'categories',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const isSupportedLanguage = (value: unknown): value is LanguageCode =>
  SUPPORTED_LANGUAGES.some(language => language.code === value);

// Device language -> app language: en/hi/te map to themselves, anything
// else falls back to English.
export const languageFromDevice = (deviceLanguageCode: string | null | undefined): LanguageCode => {
  const base = String(deviceLanguageCode ?? '').toLowerCase().split(/[-_]/)[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
};

// BCP-47 locale for dates and numbers in the current language.
export const localeFor = (language: string): string =>
  SUPPORTED_LANGUAGES.find(item => item.code === language)?.locale ?? 'en-IN';
