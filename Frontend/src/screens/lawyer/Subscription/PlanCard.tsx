import React from 'react';
import { Pressable, View } from 'react-native';

import { GenieText } from '../../../components';
import { CheckCircleIcon } from '../../../components/icons/LawyerIcons';
import { CheckIcon } from '../../../components/icons/Icons';
import { colors } from '../../../theme';
import type { PlanItem } from './types';
import { useT } from '../../../i18n/useT';

export interface PlanCardProps {
  plan: PlanItem;
  isSelected: boolean;
  isActivePlan: boolean;
  onPress: () => void;
}

// The one subscription plan card used everywhere a plan is listed: equal
// width, consistent padding, and a badge that sits in its own row so it can
// never overlap the name/price/features below it, however long the plan's
// name or price string is.
export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isSelected,
  isActivePlan,
  onPress,
}) => {
  const { t } = useT();
  const badgeLabel = plan.popular
    ? t('lawyer:plan.mostPopular')
    : isActivePlan
    ? t('lawyer:plan.activePlan')
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${plan.name}, ${plan.price}${badgeLabel ? `, ${badgeLabel}` : ''}`}
      className={`mb-4 w-full rounded-card border border-border p-4 ${
        isSelected ? 'bg-surface-secondary' : 'bg-surface active:bg-surface-secondary'
      }`}
    >
      {badgeLabel ? (
        <View className="mb-3 flex-row justify-end">
          <View
            className={`max-w-full rounded-pill px-3 py-1 ${
              plan.popular ? 'bg-gold' : 'border border-border bg-gold-muted'
            }`}
          >
            <GenieText
              variant="caption"
              tone={plan.popular ? 'on-gold' : 'gold'}
              className="font-bold"
              numberOfLines={1}
            >
              {badgeLabel}
            </GenieText>
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View
            testID={`plan-radio-${plan.id}`}
            className={`h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              isSelected ? 'bg-gold' : 'border-2 border-border'
            }`}
          >
            {isSelected ? <CheckIcon size={12} color={colors.onGold} /> : null}
          </View>
          <GenieText variant="heading-sm" className="flex-shrink font-bold" numberOfLines={1}>
            {plan.name}
          </GenieText>
        </View>

        <GenieText
          variant="heading-sm"
          className="max-w-[55%] shrink-0 font-bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {plan.price}
        </GenieText>
      </View>

      <View className="mt-4 gap-2.5">
        {plan.features.map((feature, idx) => (
          <View key={idx} className="flex-row items-center">
            <View className="shrink-0">
              <CheckCircleIcon size={18} color={colors.success} />
            </View>
            <GenieText variant="body-sm" tone="secondary" className="ml-2.5 flex-1 font-medium">
              {feature}
            </GenieText>
          </View>
        ))}
      </View>
    </Pressable>
  );
};
