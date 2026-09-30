import React from 'react';
import { View } from 'react-native';

import { GenieText } from '../../../components';
import { CheckIcon } from '../../../components/icons/Icons';
import { POST_CASE_STEPS } from './types';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

interface PostCaseStepperProps {
  currentIndex: number;
  furthestIndex: number;
}

export const PostCaseStepper: React.FC<PostCaseStepperProps> = ({
  currentIndex,
  furthestIndex,
}) => {
  const { t } = useT();
  const stepLabel = (step: string | undefined) =>
    step ? displayLabel('client:postCase.steps', step) : '';
  return (
  <View
    className="border-b border-border bg-surface px-3 pb-3 pt-4"
    accessibilityLabel={t('common:a11y.stepOf', {
      step: currentIndex + 1,
      total: POST_CASE_STEPS.length,
      title: stepLabel(POST_CASE_STEPS[currentIndex]),
    })}
  >
    <View className="flex-row">
      {POST_CASE_STEPS.map((label, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex || index <= furthestIndex;
        const isFilled = isCurrent || index < currentIndex;
        const isFirst = index === 0;
        const isLast = index === POST_CASE_STEPS.length - 1;

        return (
          <View key={label} className="flex-1 items-center">
            <View className="w-full flex-row items-center">
              <View
                className={`h-0.5 flex-1 ${
                  isFirst
                    ? 'bg-transparent'
                    : index <= currentIndex
                    ? 'bg-gold'
                    : 'bg-border'
                }`}
              />

              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isFilled ? 'bg-gold' : 'bg-surface-alt'
                }`}
              >
                {isDone && !isCurrent && index < currentIndex ? (
                  <CheckIcon size={16} color={colors.background} />
                ) : (
                  <GenieText
                    variant="body-md"
                    tone={isFilled ? 'on-gold' : 'muted'}
                    className="font-bold"
                  >
                    {String(index + 1)}
                  </GenieText>
                )}
              </View>

              <View
                className={`h-0.5 flex-1 ${
                  isLast
                    ? 'bg-transparent'
                    : index < currentIndex
                    ? 'bg-gold'
                    : 'bg-border'
                }`}
              />
            </View>

            <GenieText
              variant="caption"
              tone={isCurrent ? 'primary' : 'muted'}
              className={`mt-1.5 text-center ${isCurrent ? 'font-bold' : ''}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {stepLabel(label)}
            </GenieText>
          </View>
        );
      })}
    </View>
  </View>
  );
};
