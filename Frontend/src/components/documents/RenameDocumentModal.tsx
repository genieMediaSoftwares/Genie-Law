import React, { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { GenieButton, GenieText } from '../ui';
import { CloseIcon } from '../icons/ClientIcons';
import type { AppDocument } from '../../types/domain';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export interface RenameDocumentModalProps {
  visible: boolean;
  document: AppDocument | null;
  onClose: () => void;
  onSave: (document: AppDocument, newName: string) => Promise<void>;
}

export const RenameDocumentModal: React.FC<RenameDocumentModalProps> = ({
  visible,
  document,
  onClose,
  onSave,
}) => {
  const { t } = useT();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (visible && document) {
      setName(document.name || document.originalName || '');
      setIsSaving(false);
      setErrorText(null);
    }
  }, [visible, document]);

  if (!document) {
    return null;
  }

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorText(t('documents:rename.invalid'));
      return;
    }

    setIsSaving(true);
    setErrorText(null);

    try {
      await onSave(document, trimmed);
      onClose();
    } catch (err: any) {
      setErrorText(err.message || t('documents:rename.failed'));
    } finally {
      setIsSaving(false);
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
          <View className="mb-4 flex-row items-center justify-between">
            <GenieText variant="heading-sm" className="font-bold">
              {t('documents:rename.title')}
            </GenieText>
            <Pressable
              onPress={onClose}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={t('documents:upload.closeA11y')}
              className="p-1 active:opacity-60"
            >
              <CloseIcon size={20} color={colors.white} />
            </Pressable>
          </View>

          {errorText ? (
            <View className="mb-3 rounded-control border border-error bg-error-surface p-2.5">
              <GenieText variant="caption" tone="error">
                {errorText}
              </GenieText>
            </View>
          ) : null}

          <GenieText variant="caption" tone="secondary" className="mb-2">
            {t('documents:rename.filename')}
          </GenieText>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('documents:rename.placeholder')}
            placeholderTextColor={colors.textMuted}
            editable={!isSaving}
            autoFocus
            className="mb-5 h-12 rounded-control border border-border bg-surface px-4 text-body-md text-white focus:border-border"
          />

          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={onClose}
              disabled={isSaving}
              className="h-12 flex-1 items-center justify-center rounded-control border border-border bg-surface-alt active:bg-surface-alt"
            >
              <GenieText variant="button" tone="secondary">
                {t('common:actions.cancel')}
              </GenieText>
            </Pressable>

            <View className="flex-1">
              <GenieButton
                label={t('documents:rename.save')}
                loading={isSaving}
                onPress={handleSave}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
