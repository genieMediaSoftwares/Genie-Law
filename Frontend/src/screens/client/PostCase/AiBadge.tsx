import React from 'react';
import { View } from 'react-native';

import { GenieText } from '../../../components';
import { SparkleIcon } from '../../../components/icons/ClientIcons';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

export const AiBadge: React.FC<{ label?: string }> = ({ label: labelProp }) => {
  const { t } = useT();
  const label = labelProp ?? t('client:postCase.aiExtracted');
  return (
  <View
    className="flex-row items-center gap-1 self-start rounded-pill bg-gold-muted px-2 py-0.5"
    accessibilityLabel={label}
  >
    <SparkleIcon size={11} color={colors.gold} />
    <GenieText variant="caption" tone="gold" className="text-small-label font-bold">
      {label}
    </GenieText>
  </View>
  );
};

export const CheckBadge: React.FC = () => {
  const { t } = useT();
  return (
  <View
    className="flex-row items-center rounded-pill bg-warning-surface px-2 py-0.5"
    accessibilityLabel={t('client:postCase.needsChecking')}
  >
    <GenieText
      variant="caption"
      tone="warning"
      className="text-small-label font-bold"
    >
      {t('client:postCase.check')}
    </GenieText>
  </View>
  );
};
