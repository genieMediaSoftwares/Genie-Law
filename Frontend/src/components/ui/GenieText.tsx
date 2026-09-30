import React from 'react';
import { Text, TextProps } from 'react-native';
import { colors } from '../../theme';

export type GenieTextVariant =
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
  | 'brand';

export type GenieTextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'gold'
  | 'on-gold'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const VARIANTS: Record<GenieTextVariant, string> = {
  hero: 'text-hero font-bold',
  screenTitle: 'text-screen-title font-bold',
  sectionTitle: 'text-section-title font-semibold',
  cardTitle: 'text-card-title font-semibold',
  body: 'text-body font-normal',
  secondary: 'text-body font-normal',
  caption: 'text-caption font-normal',
  smallLabel: 'text-small-label font-medium',
  button: 'text-button font-semibold',
  statusBadge: 'text-status-badge font-medium',
  stat: 'text-stat font-semibold',

  display: 'text-hero font-bold',
  'heading-xl': 'text-screen-title font-bold',
  'heading-lg': 'text-screen-title font-bold',
  'heading-md': 'text-section-title font-semibold',
  'heading-sm': 'text-section-title font-semibold',
  'body-lg': 'text-card-title font-semibold',
  'body-md': 'text-body font-normal',
  'body-sm': 'text-body font-normal',
  label: 'text-small-label font-medium',
  brand: 'text-screen-title font-bold tracking-[2px]',
};

// Real colors, not Tailwind classes: two `text-*` color classes on the same
// element resolve by generated-stylesheet order, not by class-string order,
// so a `tone` expressed as a class can silently lose to a variant's or a
// caller's own color class (e.g. tone="on-gold" losing to gray/white). An
// inline `color` style always wins over any className, so `tone` is
// guaranteed to render as intended everywhere in the app.
const TONE_COLORS: Record<GenieTextTone, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  gold: colors.gold,
  'on-gold': colors.onGold,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.info,
};

export interface GenieTextProps extends TextProps {
  variant?: GenieTextVariant;
  tone?: GenieTextTone;
  className?: string;
}

export const GenieText: React.FC<GenieTextProps> = ({
  variant = 'body-md',
  tone = 'primary',
  className = '',
  style,
  ...rest
}) => (
  <Text
    className={`${VARIANTS[variant]} ${className}`}
    style={[{ color: TONE_COLORS[tone] }, style]}
    {...rest}
  />
);
