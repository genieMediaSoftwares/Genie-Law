import { useTranslation } from 'react-i18next';

import { NAMESPACES } from './config';

// The one translation hook for components. Keys are always written with their
// namespace, e.g. t('auth:login.title'), and are type-checked against the
// English files. Components using it re-render when the language changes.
export const useT = () => useTranslation([...NAMESPACES]);
