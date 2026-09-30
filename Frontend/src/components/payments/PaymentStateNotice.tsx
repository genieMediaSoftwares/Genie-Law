import React from 'react';
import { View } from 'react-native';

import { GenieText } from '../ui';
import { InfoCircleIcon, ShieldIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import type { PaymentState } from '../../types/payments';
import { useT } from '../../i18n/useT';
import i18n from '../../i18n';

// The one place a payment state becomes words and colour on screen.

type Tone = 'gold' | 'success' | 'error' | 'info' | 'muted';

// Title and message live in payments:state.<STATE>.{title,message}.
const TONE: Record<PaymentState, Tone> = {
  FREE: 'gold',
  COMING_SOON: 'gold',
  PAYMENT_REQUIRED: 'info',
  CHECKOUT: 'info',
  PROCESSING: 'info',
  SUCCESS: 'success',
  FAILED: 'error',
  CANCELLED: 'muted',
  REFUNDED: 'muted',
  EXPIRED: 'muted',
};

const TONE_COLOR: Record<Tone, string> = {
  gold: colors.gold,
  success: colors.success,
  error: colors.error,
  info: colors.info,
  muted: colors.textMuted,
};

export const paymentStateTitle = (state: PaymentState): string =>
  i18n.t(`payments:state.${state}.title`);

export const PaymentStateNotice: React.FC<{
  state: PaymentState;
  message?: string;
  className?: string;
}> = ({ state, message, className = '' }) => {
  const { t } = useT();
  const tone = TONE[state];
  const color = TONE_COLOR[tone];
  const Icon = tone === 'error' ? ShieldIcon : InfoCircleIcon;
  return (
    <View
      className={`flex-row items-start gap-3 rounded-card border border-border bg-card p-4 ${className}`}
      accessibilityRole="summary"
    >
      <Icon size={20} color={color} />
      <View className="flex-1">
        <GenieText variant="body" className="font-semibold" style={{ color }}>
          {t(`payments:state.${state}.title`)}
        </GenieText>
        <GenieText variant="caption" tone="secondary" className="mt-1">
          {message ?? t(`payments:state.${state}.message`)}
        </GenieText>
      </View>
    </View>
  );
};
