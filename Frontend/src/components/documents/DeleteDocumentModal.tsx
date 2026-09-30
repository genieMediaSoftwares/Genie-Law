import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { GenieButton, GenieText } from '../ui';
import { TrashIcon } from '../icons/ClientIcons';
import type { AppDocument } from '../../types/domain';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export interface DeleteDocumentModalProps {
  visible: boolean;
  document: AppDocument | null;
  onClose: () => void;
  onConfirmDelete: (document: AppDocument) => Promise<void>;
}

export const DeleteDocumentModal: React.FC<DeleteDocumentModalProps> = ({
  visible,
  document,
  onClose,
  onConfirmDelete,
}) => {
  const { t } = useT();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!document) {
    return null;
  }

  const displayName = document.name || document.originalName || t('documents:delete.thisDocument');

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorText(null);

    try {
      await onConfirmDelete(document);
      onClose();
    } catch (err: any) {
      setErrorText(err.message || t('documents:delete.failed'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-overlay px-5">
        <View className="w-full max-w-md rounded-card border border-border bg-surface p-5">
          <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-error-surface self-center">
            <TrashIcon size={24} color={colors.error} />
          </View>

          <GenieText variant="heading-sm" className="font-bold text-center">
            {t('documents:delete.title')}
          </GenieText>

          <GenieText variant="body-sm" tone="secondary" className="mt-2 text-center">
            {t('documents:delete.confirm', { name: displayName })}
          </GenieText>

          {errorText ? (
            <View className="mt-3 rounded-control border border-error bg-error-surface p-2.5">
              <GenieText variant="caption" tone="error" className="text-center">
                {errorText}
              </GenieText>
            </View>
          ) : null}

          <View className="mt-6 flex-row items-center gap-3">
            <Pressable
              onPress={onClose}
              disabled={isDeleting}
              className="h-12 flex-1 items-center justify-center rounded-control border border-border bg-surface-alt active:bg-surface-alt"
            >
              <GenieText variant="button" tone="secondary">
                {t('common:actions.cancel')}
              </GenieText>
            </Pressable>

            <View className="flex-1">
              <GenieButton
                label={t('documents:actions.delete')}
                variant="danger"
                loading={isDeleting}
                onPress={handleDelete}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
