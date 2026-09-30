import React from 'react';
import { Pressable, View } from 'react-native';
import { GenieText } from '../ui';
import { FileIcon, UploadArrowIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export interface DocumentEmptyStateProps {
  isFiltered?: boolean;
  onUpload: () => void;
}

export const DocumentEmptyState: React.FC<DocumentEmptyStateProps> = ({
  isFiltered = false,
  onUpload,
}) => {
  const { t } = useT();
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="mb-5 h-28 w-28 items-center justify-center rounded-full border border-border bg-surface">
        <FileIcon size={44} color={colors.gold} />
      </View>

      <GenieText variant="heading-md" className="font-bold text-center">
        {isFiltered ? t('documents:empty.noMatches') : t('documents:empty.none')}
      </GenieText>

      <GenieText
        variant="body-sm"
        tone="secondary"
        className="mt-2.5 max-w-[290px] text-center leading-relaxed"
      >
        {isFiltered
          ? t('documents:empty.noMatchesHint')
          : t('documents:empty.noneHint')}
      </GenieText>

      <Pressable
        onPress={onUpload}
        accessibilityRole="button"
        accessibilityLabel={t('documents:upload.title')}
        className="mt-6 h-13 min-w-[220px] flex-row items-center justify-center gap-2 rounded-control bg-gold px-6 active:bg-gold-bright"
      >
        <UploadArrowIcon size={20} color={colors.onGold} />
        <GenieText variant="button" tone="on-gold">
          {t('documents:upload.title')}
        </GenieText>
      </Pressable>
    </View>
  );
};
