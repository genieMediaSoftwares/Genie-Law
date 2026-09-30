import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';
import { SparkleIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieAiDisclaimerProps {
  className?: string;
}

// The one line that separates AI assistance from professional legal advice.
// Deliberately a quiet caption, not a banner or a dialog: it must not get in
// the way of normal use.
export const GenieAiDisclaimer: React.FC<GenieAiDisclaimerProps> = ({ className = '' }) => (
  <View
    className={`flex-row items-start gap-1.5 ${className}`}
    accessibilityRole="text"
  >
    <View className="mt-0.5">
      <SparkleIcon size={12} color={colors.textMuted} />
    </View>
    <GenieText variant="caption" tone="muted" className="flex-1 leading-4">
      {i18n.t('common:aiDisclaimer')}
    </GenieText>
  </View>
);
