import type { useT } from './useT';

type T = ReturnType<typeof useT>['t'];

// Visible label for a tab/route name (route names themselves never change).
const NAV_KEYS = {
  Home: 'common:nav.home',
  Cases: 'common:nav.cases',
  Advocates: 'common:nav.advocates',
  Profile: 'common:nav.profile',
  Workspace: 'common:nav.workspace',
  Dashboard: 'common:nav.dashboard',
  Leads: 'common:nav.leads',
  Clients: 'common:nav.clients',
  Calendar: 'common:nav.calendar',
  LawyerProfile: 'common:nav.profile',
} as const;

export const navLabel = (t: T, routeName: string): string =>
  routeName in NAV_KEYS ? t(NAV_KEYS[routeName as keyof typeof NAV_KEYS]) : routeName;
