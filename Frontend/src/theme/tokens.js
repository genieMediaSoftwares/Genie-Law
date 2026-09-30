// GenieLaw design system. Every colour in the app comes from here.
// Solid colours only: no transparent tints, gradients or glass effects.
const accent = '#F5B900';

const colors = {
  background: '#000000',
  black: '#000000',
  surface: '#111111',
  surfaceSecondary: '#161616',
  surfaceAlt: '#161616',
  card: '#111111',
  inputBackground: '#111111',

  accent,
  gold: accent,
  goldBright: '#FFC61A',
  goldPressed: '#D9A400',
  goldMuted: '#161616',
  goldWash: '#242424',

  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1A1',
  textMuted: '#707070',
  textPlaceholder: '#555555',

  border: '#242424',
  borderFocused: '#4A4A4A',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  verifiedBadge: '#0095F6',

  successSurface: '#0E2A18',
  warningSurface: '#2B2008',
  errorSurface: '#2B0F0F',
  infoSurface: '#0F1B33',

  onGold: '#000000',
  onAccent: '#000000',

  overlay: 'rgba(0, 0, 0, 0.72)',
  disabled: '#2E2E2E',
  disabledText: '#707070',

  skeleton: '#161616',
  skeletonHighlight: '#1F1F1F',
};

const radius = {
  control: 10,
  buttonSmall: 8,
  card: 12,
  badge: 14,
  sheet: 20,
  pill: 9999,
  full: 9999,
};

const sizing = {
  control: 48,
  touch: 44,
  buttonSmall: 36,
  iconButton: 40,
  badgeHeight: 28,
  tabHeight: 44,
  bottomNavHeight: 64,
  headerHeight: 56,
  screenGutter: 16,
};

module.exports = { colors, radius, sizing };

