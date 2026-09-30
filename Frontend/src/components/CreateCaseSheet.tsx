import React from 'react';
import { Pressable, View } from 'react-native';

import { GenieBottomSheet, GenieText } from './ui';
import { ChevronRightIcon, FileIcon, SparkleIcon } from './icons/ClientIcons';
import { colors } from '../theme';
import { useT } from '../i18n/useT';

interface CreateCaseSheetProps {
  visible: boolean;
  onClose: () => void;
  onStartManual: () => void;
  onStartAi: () => void;
}

export const CreateCaseSheet: React.FC<CreateCaseSheetProps> = ({
  visible,
  onClose,
  onStartManual,
  onStartAi,
}) => {
  const { t } = useT();
  return (
  <GenieBottomSheet visible={visible} onClose={onClose}>
    <View className="pb-4">
      <GenieText variant="heading-lg">{t('client:createCase.title')}</GenieText>
      <GenieText variant="body-sm" tone="secondary" className="mb-4 mt-1">
        {t('client:createCase.subtitle')}
      </GenieText>

      <Pressable
        onPress={onStartAi}
        accessibilityRole="button"
        accessibilityLabel={t('client:createCase.withAi')}
        className="mb-3 flex-row items-center rounded-card border border-border bg-card p-3 active:opacity-80"
      >
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gold-muted">
          <SparkleIcon size={20} color={colors.gold} />
        </View>

        <View className="mr-1 flex-1">
          <GenieText variant="body-sm" className="font-bold">
            {t('client:createCase.withAi')}
          </GenieText>
          <GenieText variant="caption" tone="muted" className="mt-0.5">
            {t('client:createCase.withAiDescription')}
          </GenieText>
        </View>

        <ChevronRightIcon size={18} color={colors.gold} />
      </Pressable>

      <Pressable
        onPress={onStartManual}
        accessibilityRole="button"
        accessibilityLabel={t('client:createCase.manual')}
        className="mb-3 flex-row items-center rounded-card border border-border bg-card p-3 active:opacity-80"
      >
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface-alt">
          <FileIcon size={20} color={colors.textSecondary} />
        </View>

        <View className="mr-1 flex-1">
          <GenieText variant="body-sm" className="font-bold">
            {t('client:createCase.manual')}
          </GenieText>
          <GenieText variant="caption" tone="muted" className="mt-0.5">
            {t('client:createCase.manualDescription')}
          </GenieText>
        </View>

        <ChevronRightIcon size={18} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common:actions.close')}
        className="mt-1 min-h-touch items-center justify-center active:opacity-80"
      >
        <GenieText variant="body-sm" tone="secondary">
          {t('common:actions.close')}
        </GenieText>
      </Pressable>
    </View>
  </GenieBottomSheet>
  );
};
