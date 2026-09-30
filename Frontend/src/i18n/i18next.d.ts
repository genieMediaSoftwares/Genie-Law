import 'i18next';

import type { EnglishResources } from './resources';

// Type-checked keys: t('auth:login.title') fails to compile if the key does
// not exist in the English files, so a typo can never reach users.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: EnglishResources;
    returnNull: false;
  }
}
