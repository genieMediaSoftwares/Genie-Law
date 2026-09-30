import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n, { changeLanguage, currentLanguage } from '../index';
import { LANGUAGE_STORAGE_KEY } from '../config';
import { toAppError } from '../../utils/errors';

const localesDir = path.join(__dirname, '..', 'locales');
const flatten = (value: object, prefix = ''): string[] =>
  Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object' ? flatten(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

afterEach(async () => {
  await changeLanguage('en');
});

it('has the same keys in English, Hindi and Telugu', () => {
  for (const file of fs.readdirSync(path.join(localesDir, 'en'))) {
    const read = (lang: string) =>
      flatten(JSON.parse(fs.readFileSync(path.join(localesDir, lang, file), 'utf8'))).sort();
    const english = read('en');
    expect({ file, keys: read('hi') }).toEqual({ file, keys: english });
    expect({ file, keys: read('te') }).toEqual({ file, keys: english });
  }
});

it('switches the language at once and remembers the choice', async () => {
  await changeLanguage('hi');
  expect(currentLanguage()).toBe('hi');
  expect(i18n.t('common:actions.tryAgain')).toBe(
    JSON.parse(fs.readFileSync(path.join(localesDir, 'hi', 'common.json'), 'utf8')).actions.tryAgain,
  );
  await expect(AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).resolves.toBe('hi');
});

it('shows error messages in the language selected when they appear', async () => {
  await changeLanguage('te');
  const info = toAppError({ isAxiosError: true, code: 'ERR_NETWORK', config: {} });
  expect(info.message).toBe(
    JSON.parse(fs.readFileSync(path.join(localesDir, 'te', 'common.json'), 'utf8')).errors.offline,
  );
});

it('falls back to English for a key missing in the current language', async () => {
  await changeLanguage('te');
  i18n.addResource('en', 'common', 'testOnly.fallback', 'English text');
  expect(i18n.t('common:testOnly.fallback')).toBe('English text');
});
