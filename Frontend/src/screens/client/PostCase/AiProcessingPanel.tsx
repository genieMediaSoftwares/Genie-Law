import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, View } from 'react-native';

import { GenieText } from '../../../components';
import { SparkleIcon } from '../../../components/icons/ClientIcons';
import { CheckIcon } from '../../../components/icons/Icons';
import { colors } from '../../../theme';
import { USE_NATIVE_DRIVER } from '../../../utils/platform';
import { useT } from '../../../i18n/useT';

const STAGE_ROWS = [
  { labelKey: 'client:postCase.processing.uploading', stages: ['uploading'] },
  { labelKey: 'client:postCase.processing.reading', stages: ['queued', 'ocr', 'transcribing'] },
  { labelKey: 'client:postCase.processing.extracting', stages: ['extracting'] },
  { labelKey: 'client:postCase.processing.preparing', stages: ['classifying'] },
  { labelKey: 'client:postCase.processing.finding', stages: ['completed'] },
] as const;

const rowIndexForStage = (stage: string): number => {
  const index = STAGE_ROWS.findIndex(row => (row.stages as readonly string[]).includes(stage));
  return index === -1 ? 1 : index;
};

interface AiProcessingPanelProps {
  percent: number;
  message: string;
  current?: number | null;
  total?: number | null;
  stage?: string;
  uploading?: boolean;
}

export const AiProcessingPanel: React.FC<AiProcessingPanelProps> = ({
  percent,
  message,
  current,
  total,
  stage = 'queued',
  uploading = false,
}) => {
  const { t } = useT();
  const pulse = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [percent, width]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Animated.View
        style={{ transform: [{ scale }] }}
        className="h-20 w-20 items-center justify-center rounded-full bg-gold-muted"
      >
        <SparkleIcon size={34} color={colors.gold} />
      </Animated.View>

      <GenieText variant="heading-sm" className="mt-5 text-center">
        {message}
      </GenieText>

      {typeof current === 'number' && typeof total === 'number' && total > 0 ? (
        <GenieText variant="body-sm" tone="secondary" className="mt-1">
          {t('client:postCase.processing.progress', { current, total })}
        </GenieText>
      ) : null}

      <View className="mt-5 h-1.5 w-full overflow-hidden rounded-pill bg-surface-alt">
        <Animated.View
          className="h-full rounded-pill bg-gold"
          style={{
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>

      <GenieText variant="body-sm" tone="gold" className="mt-2 font-bold">
        {`${Math.round(percent)}%`}
      </GenieText>

      <View className="mt-6 w-full">
        {STAGE_ROWS.map((row, index) => {
          const activeIndex = rowIndexForStage(uploading ? 'uploading' : stage);
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;

          return (
            <View key={row.labelKey} className="flex-row items-center gap-3 py-1.5">
              <View
                className={`h-5 w-5 items-center justify-center rounded-full border ${
                  isDone
                    ? 'border-success bg-success'
                    : isActive
                    ? 'border-border bg-gold-muted'
                    : 'border-border'
                }`}
              >
                {isDone ? (
                  <CheckIcon size={12} color={colors.background} />
                ) : isActive ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : null}
              </View>

              <GenieText
                variant="body-sm"
                tone={isDone ? 'secondary' : isActive ? 'gold' : 'muted'}
                className={isActive ? 'font-semibold' : ''}
              >
                {t(row.labelKey)}
              </GenieText>
            </View>
          );
        })}
      </View>

      <GenieText variant="caption" tone="muted" className="mt-5 text-center">
        {uploading
          ? t('client:postCase.processing.keepOpen')
          : t('client:postCase.processing.readingTakesLongest')}
      </GenieText>
    </View>
  );
};
