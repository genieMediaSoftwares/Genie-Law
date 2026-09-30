import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';
import type { GenieTextTone } from './GenieText';
import { AlertIcon, CheckIcon } from '../icons/Icons';
import { InfoCircleIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';

export type GenieNoticeTone = 'error' | 'success' | 'warning' | 'info' | 'gold';

const TONES: Record<
  GenieNoticeTone,
  { surface: string; border: string; text: GenieTextTone; color: string }
> = {
  error: {
    surface: 'bg-error-surface',
    border: 'border-error',
    text: 'error',
    color: colors.error,
  },
  success: {
    surface: 'bg-success-surface',
    border: 'border-success',
    text: 'success',
    color: colors.success,
  },
  warning: {
    surface: 'bg-warning-surface',
    border: 'border-warning',
    text: 'warning',
    color: colors.warning,
  },
  info: {
    surface: 'bg-info-surface',
    border: 'border-info',
    text: 'info',
    color: colors.info,
  },
  gold: {
    surface: 'bg-gold-muted',
    border: 'border-border',
    text: 'gold',
    color: colors.gold,
  },
};

export interface GenieNoticeProps {
  message?: string | null;
  tone?: GenieNoticeTone;
  className?: string;
}

export const GenieNotice: React.FC<GenieNoticeProps> = ({
  message,
  tone = 'error',
  className = '',
}) => {
  if (!message) {
    return null;
  }

  const { surface, border, text, color } = TONES[tone];

  return (
    <View
      className={`flex-row items-start rounded-control border px-4 py-3 ${surface} ${border} ${className}`}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {tone === 'success' ? (
        <CheckIcon size={18} color={color} />
      ) : tone === 'info' || tone === 'gold' ? (
        <InfoCircleIcon size={18} color={color} />
      ) : (
        <AlertIcon size={18} color={color} />
      )}
      <GenieText variant="body-sm" tone={text} className="ml-2 flex-1">
        {message}
      </GenieText>
    </View>
  );
};
