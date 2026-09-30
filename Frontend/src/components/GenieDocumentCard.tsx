import React from 'react';
import { Pressable, View } from 'react-native';
import { GenieText } from './ui';
import { FileIcon, TrashIcon } from './icons/ClientIcons';
import { formatFileSize } from '../utils/format';
import { colors } from '../theme';
import { useT } from '../i18n/useT';

export type GenieDocumentCardState = 'idle' | 'uploading' | 'error';

export interface GenieDocumentCardProps {
  name: string;
  size?: number | string | null;
  state?: GenieDocumentCardState;
  error?: string;
  onPress?: () => void;
  onRemove?: () => void;
  className?: string;
}

export const GenieDocumentCard: React.FC<GenieDocumentCardProps> = ({
  name,
  size,
  state = 'idle',
  error,
  onPress,
  onRemove,
  className = '',
}) => {
  const { t } = useT();
  const formattedSize =
    typeof size === 'number'
      ? formatFileSize(size)
      : typeof size === 'string'
      ? size
      : '';

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? name : undefined}
      className={[
        'mb-1 flex-row items-center rounded-control border bg-surface p-2',
        state === 'error' ? 'border-error' : 'border-border',
        onPress ? 'active:opacity-80' : '',
        className,
      ].join(' ')}
    >
      <View className="mr-2 h-9 w-9 items-center justify-center rounded-lg bg-surface-alt">
        <FileIcon size={22} color={colors.gold} />
      </View>

      <View className="flex-1">
        <GenieText variant="body-sm" className="font-medium" numberOfLines={1}>
          {name}
        </GenieText>

        {state === 'error' ? (
          <GenieText variant="caption" tone="error" className="mt-0.5" numberOfLines={1}>
            {error || t('documents:uploadFailed')}
          </GenieText>
        ) : state === 'uploading' ? (
          <GenieText variant="caption" tone="gold" className="mt-0.5">
            Uploading…
          </GenieText>
        ) : formattedSize ? (
          <GenieText variant="caption" tone="muted" className="mt-0.5">
            {formattedSize}
          </GenieText>
        ) : null}
      </View>

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common:a11y.removeItem', { name })}
          className="p-1"
        >
          <TrashIcon size={18} color={colors.error} />
        </Pressable>
      ) : null}
    </Container>
  );
};
