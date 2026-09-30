import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { GenieText } from '../ui';
import { FileIcon, ImageIcon, MoreVerticalIcon } from '../icons/ClientIcons';
import { formatDocumentMeta, getDocumentBadgeInfo } from './documentUtils';
import type { AppDocument } from '../../types/domain';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export interface DocumentCardProps {
  document: AppDocument;
  onPress: (document: AppDocument) => void;
  onPressMenu: (document: AppDocument) => void;
}

// Memoized: list rows re-render only when their own props change, not on
// every parent update (e.g. a background refetch of the list).
export const DocumentCard = memo<DocumentCardProps>(({
  document,
  onPress,
  onPressMenu,
}) => {
  const { t } = useT();
  const badge = getDocumentBadgeInfo(document);
  const displayName = document.name || document.originalName || t('documents:viewer.untitled');
  const metaText = formatDocumentMeta(document);

  const renderBadgeIcon = () => {
    if (badge.category === 'image') {
      return <ImageIcon size={18} color="#34D399" />;
    }
    return (
      <FileIcon
        size={18}
        color={
          badge.category === 'pdf'
            ? '#EF4444'
            : badge.category === 'docx'
            ? '#60A5FA'
            : colors.textSecondary
        }
      />
    );
  };

  return (
    <Pressable
      onPress={() => onPress(document)}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${metaText}`}
      className="mb-2.5 flex-row items-center rounded-card border border-border bg-surface p-3.5 active:bg-surface-alt"
    >
      <View
        className={`h-11 w-11 items-center justify-center rounded-lg border ${badge.bgColor} ${badge.borderColor}`}
      >
        {renderBadgeIcon()}
      </View>

      <View className="ml-3 flex-1">
        <GenieText variant="body-md" className="font-bold" numberOfLines={1}>
          {displayName}
        </GenieText>

        <GenieText variant="caption" tone="secondary" className="mt-0.5" numberOfLines={1}>
          {metaText}
        </GenieText>
      </View>

      <Pressable
        onPress={() => onPressMenu(document)}
        accessibilityRole="button"
        accessibilityLabel={t('documents:actions.options')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        className="ml-2 p-1 active:opacity-60"
      >
        <MoreVerticalIcon size={20} color={colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
});

(DocumentCard as React.NamedExoticComponent).displayName = 'DocumentCard';
