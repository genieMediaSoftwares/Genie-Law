import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
  isSupportedLanguage,
  languageFromDevice,
} from './config';
import type { LanguageCode } from './config';
import { resources } from './resources';

// App-wide i18n. Translations are bundled with the app (no network), so
// switching language is instant and works offline.
//
// Startup: initI18n() runs before the first render (App.tsx waits for it):
//   1. a language the user picked earlier (AsyncStorage) always wins;
//   2. otherwise, on first launch, the device language (en/hi/te, else en).
// The device language is never saved, so a user who has not chosen yet keeps
// following the device; once they choose in Settings, that choice sticks.

const readSavedLanguage = async (): Promise<LanguageCode | null> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(saved) ? saved : null;
  } catch {
    return null;
  }
};

const deviceLanguage = (): LanguageCode => {
  try {
    return languageFromDevice(getLocales()[0]?.languageCode);
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

let initialising: Promise<void> | null = null;

export function initI18n(): Promise<void> {
  if (!initialising) {
    initialising = (async () => {
      const language = (await readSavedLanguage()) ?? deviceLanguage();
      await i18n.use(initReactI18next).init({
        resources,
        lng: language,
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: ['en', 'hi', 'te'],
        ns: [...NAMESPACES],
        defaultNS: 'common',
        interpolation: { escapeValue: false }, // React already escapes
        returnNull: false,
        returnEmptyString: false,
        // A missing key shows the English text, never "undefined"; in
        // development it is also logged so it can be added.
        saveMissing: __DEV__,
        missingKeyHandler: (languages, namespace, key) => {
          if (__DEV__) {
            console.warn(`[i18n] missing "${namespace}:${key}" for ${languages.join(', ')}`);
          }
        },
        react: { useSuspense: false },
      });
    })();
  }
  return initialising;
}

// Settings → Language: switches the whole UI at once and remembers the choice.
export async function changeLanguage(language: LanguageCode): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The UI already switched; it just won't be remembered after a restart.
  }
}

export const currentLanguage = (): LanguageCode =>
  isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

export default i18n;
