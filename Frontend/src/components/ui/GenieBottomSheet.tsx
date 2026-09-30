import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GenieText } from './GenieText';
import { GenieIconButton } from './GenieIconButton';
import { CloseIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const GenieBottomSheet: React.FC<GenieBottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  footer,
  className = '',
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <View className="flex-1 justify-end">
      <Pressable
        className="absolute inset-0 bg-overlay"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('common:actions.close')}
      />

      <SafeAreaView edges={['bottom']} className={`rounded-t-sheet bg-surface ${className}`}>
        <View className="items-center pt-3">
          <View className="h-1 w-10 rounded-pill bg-border" />
        </View>

        {title ? (
          <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
            <GenieText variant="heading-md">{title}</GenieText>
            <GenieIconButton
              icon={<CloseIcon size={20} color={colors.textSecondary} />}
              onPress={onClose}
              accessibilityLabel={i18n.t('common:actions.close')}
            />
          </View>
        ) : null}

        <View className="px-5 pb-2">{children}</View>

        {footer ? (
          <View className="border-t border-border px-5 pb-2 pt-4">{footer}</View>
        ) : null}
      </SafeAreaView>
    </View>
  </Modal>
);
