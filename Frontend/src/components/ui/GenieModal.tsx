import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { GenieText } from './GenieText';
import { GenieIconButton } from './GenieIconButton';
import { CloseIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissOnBackdropPress?: boolean;
  className?: string;
}

export const GenieModal: React.FC<GenieModalProps> = ({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissOnBackdropPress = true,
  className = '',
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <View className="flex-1 items-center justify-center px-6">
      <Pressable
        className="absolute inset-0 bg-overlay"
        onPress={dismissOnBackdropPress ? onClose : undefined}
        disabled={!dismissOnBackdropPress}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('common:actions.close')}
      />

      <View
        className={`w-full max-w-md rounded-card border border-border bg-surface p-5 ${className}`}
        accessibilityViewIsModal
      >
        {title ? (
          <View className="mb-3 flex-row items-center justify-between">
            <GenieText variant="heading-md" className="flex-1 pr-2">
              {title}
            </GenieText>
            <GenieIconButton
              icon={<CloseIcon size={20} color={colors.textSecondary} />}
              onPress={onClose}
              accessibilityLabel={i18n.t('common:actions.close')}
            />
          </View>
        ) : null}

        {children}

        {footer ? <View className="mt-5">{footer}</View> : null}
      </View>
    </View>
  </Modal>
);
