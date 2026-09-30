export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screenGutter: 16,
} as const;

export const sizing = {
  controlHeight: 44,
  buttonSmallHeight: 36,
  iconButtonSize: 40,
  inputHeight: 48,
  badgeHeight: 28,
  tabHeight: 44,
  bottomNavHeight: 64,
  headerHeight: 56,
  avatarSm: 32,
  avatarMd: 40,
  avatarCard: 48,
  avatarProfile: 64,
  avatarLg: 80,
  iconLg: 24,
  iconMd: 20,
  iconSm: 18,
  iconNav: 22,
  iconSize: 20,
  screenPadding: 16,
  cardPadding: 16,
  cardGap: 12,
} as const;

export const radius = {
  xs: 4,
  buttonSmall: 8,
  button: 10,
  control: 10,
  input: 10,
  tab: 10,
  card: 12,
  badge: 14,
  sheet: 20,
  pill: 9999,
  full: 9999,
} as const;

export const elevation = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0 },
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 6 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  gold: { shadowColor: '#F5B900', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8 },
  goldLg: { shadowColor: '#F5B900', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
} as const;

export const duration = {
  fast: 120,
  normal: 200,
  slow: 300,
} as const;

