import React from 'react';
import { Pressable, View } from 'react-native';
import { GenieText } from '../ui';
import { RefreshIcon, WifiOffIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export interface DocumentErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export const DocumentErrorState: React.FC<DocumentErrorStateProps> = ({
  onRetry,
  message,
}) => {
  const { t } = useT();
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <View className="mb-5 items-center justify-center">
        <WifiOffIcon size={56} color={colors.textMuted} />
      </View>

      <GenieText variant="heading-md" className="font-bold text-center">
        {t('documents:loadError.title')}
      </GenieText>

      <GenieText
        variant="body-sm"
        tone="secondary"
        className="mt-2.5 max-w-[280px] text-center leading-relaxed"
      >
        {message || t('documents:loadError.hint')}
      </GenieText>

      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t('common:actions.tryAgain')}
        className="mt-6 h-13 min-w-[200px] flex-row items-center justify-center gap-2.5 rounded-control bg-gold px-6 active:bg-gold-bright"
      >
        <RefreshIcon size={18} color={colors.onGold} />
        <GenieText variant="button" tone="on-gold">
          {t('documents:loadError.tryAgain')}
        </GenieText>
      </Pressable>
    </View>
  );
};
