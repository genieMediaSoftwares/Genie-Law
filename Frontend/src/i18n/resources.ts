// Bundled translations: every language ships every namespace.
// Generated list; keep in sync with NAMESPACES in ./config.ts.

import en_common from './locales/en/common.json';
import en_auth from './locales/en/auth.json';
import en_home from './locales/en/home.json';
import en_profile from './locales/en/profile.json';
import en_cases from './locales/en/cases.json';
import en_documents from './locales/en/documents.json';
import en_notifications from './locales/en/notifications.json';
import en_settings from './locales/en/settings.json';
import en_lawyer from './locales/en/lawyer.json';
import en_client from './locales/en/client.json';
import en_assistant from './locales/en/assistant.json';
import en_payments from './locales/en/payments.json';
import en_categories from './locales/en/categories.json';
import hi_common from './locales/hi/common.json';
import hi_auth from './locales/hi/auth.json';
import hi_home from './locales/hi/home.json';
import hi_profile from './locales/hi/profile.json';
import hi_cases from './locales/hi/cases.json';
import hi_documents from './locales/hi/documents.json';
import hi_notifications from './locales/hi/notifications.json';
import hi_settings from './locales/hi/settings.json';
import hi_lawyer from './locales/hi/lawyer.json';
import hi_client from './locales/hi/client.json';
import hi_assistant from './locales/hi/assistant.json';
import hi_payments from './locales/hi/payments.json';
import hi_categories from './locales/hi/categories.json';
import te_common from './locales/te/common.json';
import te_auth from './locales/te/auth.json';
import te_home from './locales/te/home.json';
import te_profile from './locales/te/profile.json';
import te_cases from './locales/te/cases.json';
import te_documents from './locales/te/documents.json';
import te_notifications from './locales/te/notifications.json';
import te_settings from './locales/te/settings.json';
import te_lawyer from './locales/te/lawyer.json';
import te_client from './locales/te/client.json';
import te_assistant from './locales/te/assistant.json';
import te_payments from './locales/te/payments.json';
import te_categories from './locales/te/categories.json';

const en = {
  common: en_common,
  auth: en_auth,
  home: en_home,
  profile: en_profile,
  cases: en_cases,
  documents: en_documents,
  notifications: en_notifications,
  settings: en_settings,
  lawyer: en_lawyer,
  client: en_client,
  assistant: en_assistant,
  payments: en_payments,
  categories: en_categories,
};

const hi = {
  common: hi_common,
  auth: hi_auth,
  home: hi_home,
  profile: hi_profile,
  cases: hi_cases,
  documents: hi_documents,
  notifications: hi_notifications,
  settings: hi_settings,
  lawyer: hi_lawyer,
  client: hi_client,
  assistant: hi_assistant,
  payments: hi_payments,
  categories: hi_categories,
};

const te = {
  common: te_common,
  auth: te_auth,
  home: te_home,
  profile: te_profile,
  cases: te_cases,
  documents: te_documents,
  notifications: te_notifications,
  settings: te_settings,
  lawyer: te_lawyer,
  client: te_client,
  assistant: te_assistant,
  payments: te_payments,
  categories: te_categories,
};

export const resources = { en, hi, te } as const;

// English is the source of truth for keys (and for type checking).
export type EnglishResources = typeof en;
