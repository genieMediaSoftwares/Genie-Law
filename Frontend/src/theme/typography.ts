import { Platform, TextStyle } from 'react-native';

const family = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const familyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

const familyBold = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export type TypographyVariant =
  | 'hero'
  | 'screenTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'body'
  | 'secondary'
  | 'caption'
  | 'smallLabel'
  | 'button'
  | 'statusBadge'
  | 'stat'
  | 'display'
  | 'heading-xl'
  | 'heading-lg'
  | 'heading-md'
  | 'heading-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'label'
  | 'brand'
  | 'title'
  | 'subtitle'
  | 'link';

export const typographyClasses: Record<TypographyVariant, string> = {
  hero: 'text-[28px] leading-[34px] font-bold',
  screenTitle: 'text-[24px] leading-[29px] font-bold',
  sectionTitle: 'text-[18px] leading-[23px] font-semibold',
  cardTitle: 'text-[16px] leading-[21px] font-semibold',
  body: 'text-[14px] leading-[20px] font-normal',
  secondary: 'text-[13px] leading-[18px] font-normal text-textSecondary',
  caption: 'text-[12px] leading-[16px] font-normal text-textMuted',
  smallLabel: 'text-[11px] leading-[14px] font-medium',
  button: 'text-[14px] leading-[18px] font-semibold',
  statusBadge: 'text-[12px] leading-[16px] font-medium',
  stat: 'text-[20px] leading-[24px] font-semibold',

  display: 'text-[28px] leading-[34px] font-bold',
  'heading-xl': 'text-[24px] leading-[29px] font-bold',
  'heading-lg': 'text-[24px] leading-[29px] font-bold',
  'heading-md': 'text-[18px] leading-[23px] font-semibold',
  'heading-sm': 'text-[18px] leading-[23px] font-semibold',
  'body-lg': 'text-[16px] leading-[21px] font-semibold',
  'body-md': 'text-[14px] leading-[20px] font-normal',
  'body-sm': 'text-[13px] leading-[18px] font-normal',
  label: 'text-[14px] leading-[18px] font-semibold',
  brand: 'text-[24px] leading-[29px] font-bold tracking-[2px]',
  title: 'text-[24px] leading-[29px] font-bold',
  subtitle: 'text-[13px] leading-[18px] font-normal',
  link: 'text-[14px] leading-[18px] font-semibold text-gold',
};

export const typography = {
  fontFamily: {
    regular: family,
    medium: familyMedium,
    bold: familyBold,
  },
  fontSize: {
    smallLabel: 11,
    caption: 12,
    statusBadge: 12,
    secondary: 13,
    body: 14,
    button: 14,
    cardTitle: 16,
    sectionTitle: 18,
    stat: 20,
    screenTitle: 24,
    hero: 28,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    hero: 34,
    screenTitle: 29,
    sectionTitle: 23,
    cardTitle: 21,
    body: 20,
    secondary: 18,
    caption: 16,
    smallLabel: 14,
    button: 18,
    statusBadge: 16,
    stat: 24,
  },
  hero: {
    fontFamily: familyBold,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  } as TextStyle,
  screenTitle: {
    fontFamily: familyBold,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 29,
  } as TextStyle,
  sectionTitle: {
    fontFamily: familyMedium,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 23,
  } as TextStyle,
  cardTitle: {
    fontFamily: familyMedium,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  } as TextStyle,
  body: {
    fontFamily: family,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,
  secondary: {
    fontFamily: family,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  } as TextStyle,
  caption: {
    fontFamily: family,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,
  smallLabel: {
    fontFamily: familyMedium,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  } as TextStyle,
  button: {
    fontFamily: familyMedium,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  } as TextStyle,
  statusBadge: {
    fontFamily: familyMedium,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  } as TextStyle,
  stat: {
    fontFamily: familyMedium,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,
};

