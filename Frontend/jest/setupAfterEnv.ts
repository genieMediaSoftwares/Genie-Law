/* eslint-env jest */
import { initI18n } from '../src/i18n';

// The real translations, as the app loads them (English: the device mock).
beforeAll(async () => {
  await initI18n();
});
