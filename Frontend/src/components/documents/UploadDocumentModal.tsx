import React, { useState, useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { GenieButton, GenieText } from '../ui';
import {
  CloseIcon,
  FolderIcon,
  ImageIcon,
  ScanIcon,
  UploadArrowIcon,
} from '../icons/ClientIcons';
import { filePicker } from '../../services/filePicker';
import { rejectOversizedDocuments } from '../../services/documentSizeGuard';
import { formatFileSize } from '../../utils/urls';
import { rejectionReasonFor } from '../../api/aiApi';
import type { PickedFile } from '../../types/ai';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export interface UploadDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (file: PickedFile) => Promise<void>;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  visible,
  onClose,
  onUpload,
}) => {
  const { t } = useT();
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Set synchronously, so a double tap before the next render uploads once.
  const uploadingRef = useRef(false);

  const handlePickFile = async () => {
    setErrorText(null);
    try {
      const { accepted: files } = await rejectOversizedDocuments(
        await filePicker.pickDocuments(1),
      );
      if (files.length > 0) {
        const file = files[0];
        const rejection = rejectionReasonFor(file);
        if (rejection) {
          setErrorText(rejection);
          return;
        }
        setSelectedFile(file);
      }
    } catch (err: any) {
      setErrorText(err.message || t('documents:upload.selectFailed'));
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile || uploadingRef.current) {
      return;
    }

    uploadingRef.current = true;
    setIsUploading(true);
    setErrorText(null);

    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      setErrorText(err.message || t('documents:upload.uploadFailed'));
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setSelectedFile(null);
    setErrorText(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-overlay">
        <Pressable className="flex-1" onPress={handleClose} />

        <View className="rounded-t-2xl border-t border-border bg-surface px-5 pb-8 pt-4">
          <View className="mb-4 flex-row items-center justify-between">
            <GenieText variant="heading-md" className="font-bold">
              {t('documents:upload.title')}
            </GenieText>
            <Pressable
              onPress={handleClose}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel={t('documents:upload.closeA11y')}
              className="p-1 active:opacity-60"
            >
              <CloseIcon size={20} color={colors.white} />
            </Pressable>
          </View>

          {errorText ? (
            <View className="mb-3 rounded-control border border-error bg-error-surface p-3">
              <GenieText variant="caption" tone="error">
                {errorText}
              </GenieText>
            </View>
          ) : null}

          <Pressable
            onPress={handlePickFile}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel={t('documents:upload.tapA11y')}
            className="mb-4 items-center justify-center rounded-card border-2 border-dashed border-border bg-surface-alt p-6 active:bg-surface-alt"
          >
            <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-gold-muted">
              <UploadArrowIcon size={24} color={colors.gold} />
            </View>

            <GenieText variant="body-lg" className="font-bold">
              {t('documents:upload.tap')}
            </GenieText>

            <GenieText variant="caption" tone="secondary" className="mt-1 text-center">
              {t('documents:upload.formats')}
            </GenieText>
          </Pressable>

          {selectedFile ? (
            <View className="mb-4 rounded-card border border-border bg-surface-alt p-3.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <GenieText variant="body-md" className="font-bold" numberOfLines={1}>
                    {selectedFile.name}
                  </GenieText>
                  <GenieText variant="caption" tone="gold" className="mt-0.5">
                    {formatFileSize(selectedFile.size)}
                  </GenieText>
                </View>
                <Pressable
                  onPress={() => setSelectedFile(null)}
                  disabled={isUploading}
                  className="ml-2 rounded-full p-1 active:bg-surface"
                >
                  <CloseIcon size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              <GenieButton
                label={isUploading ? t('documents:upload.uploading') : t('documents:upload.uploadNow')}
                loading={isUploading}
                onPress={handleStartUpload}
                className="mt-3"
              />
            </View>
          ) : null}

          <View className="my-3 flex-row items-center gap-3">
            <View className="flex-1 h-px bg-border" />
            <GenieText variant="caption" tone="muted">
              {t('documents:upload.or')}
            </GenieText>
            <View className="flex-1 h-px bg-border" />
          </View>

          <View className="gap-2.5">
            <Pressable
              onPress={handlePickFile}
              disabled={isUploading}
              className="h-13 flex-row items-center gap-3 rounded-card border border-border bg-surface-alt px-4 active:bg-surface-alt"
            >
              <ImageIcon size={20} color={colors.white} />
              <GenieText variant="body-md" className="font-medium">
                {t('documents:upload.gallery')}
              </GenieText>
            </Pressable>

            <Pressable
              onPress={handlePickFile}
              disabled={isUploading}
              className="h-13 flex-row items-center gap-3 rounded-card border border-border bg-surface-alt px-4 active:bg-surface-alt"
            >
              <FolderIcon size={20} color={colors.white} />
              <GenieText variant="body-md" className="font-medium">
                {t('documents:upload.chooseFile')}
              </GenieText>
            </Pressable>

            <Pressable
              onPress={handlePickFile}
              disabled={isUploading}
              className="h-13 flex-row items-center gap-3 rounded-card border border-border bg-surface-alt px-4 active:bg-surface-alt"
            >
              <ScanIcon size={20} color={colors.white} />
              <GenieText variant="body-md" className="font-medium">
                {t('documents:upload.scan')}
              </GenieText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
