import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';
import { CheckIcon } from '../icons/Icons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieProgressStepperProps {
  steps: readonly string[];
  currentIndex: number;
  className?: string;
}

// Inline tracker, drawn straight into its parent: no box of its own.
export const GenieProgressStepper: React.FC<GenieProgressStepperProps> = ({
  steps,
  currentIndex,
  className = '',
}) => (
  <View
    className={`flex-row ${className}`}
    accessibilityLabel={i18n.t('common:a11y.stepOf', {
      step: currentIndex + 1,
      total: steps.length,
      title: steps[currentIndex] ?? '',
    })}
  >
    {steps.map((stage, index) => {
      const complete = index < currentIndex;
      const current = index === currentIndex;
      const isFirst = index === 0;
      const isLast = index === steps.length - 1;

      return (
        <View key={stage} className="flex-1 items-center">
          <View className="w-full flex-row items-center">
            <View
              className={`h-0.5 flex-1 ${
                isFirst ? 'bg-transparent' : index <= currentIndex ? 'bg-gold' : 'bg-border'
              }`}
            />

            {complete ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-gold">
                <CheckIcon size={12} color={colors.onGold} />
              </View>
            ) : current ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-gold">
                <View className="h-2 w-2 rounded-full bg-on-gold" />
              </View>
            ) : (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-surface-secondary">
                <View className="h-1.5 w-1.5 rounded-full bg-muted" />
              </View>
            )}

            <View
              className={`h-0.5 flex-1 ${
                isLast ? 'bg-transparent' : index < currentIndex ? 'bg-gold' : 'bg-border'
              }`}
            />
          </View>

          <GenieText
            variant="caption"
            tone={current ? 'gold' : complete ? 'primary' : 'muted'}
            className="mt-1.5 text-center text-small-label"
            numberOfLines={1}
          >
            {stage}
          </GenieText>
        </View>
      );
    })}
  </View>
);
