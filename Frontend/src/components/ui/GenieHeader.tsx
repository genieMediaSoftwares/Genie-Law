import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';
import { GenieIconButton } from './GenieIconButton';
import { GenieWordmark } from './GenieWordmark';
import { BackIcon } from '../icons/Icons';
import { BellIcon, MenuIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  onNotifications?: () => void;
  notificationCount?: number;
  right?: React.ReactNode;
  showBrand?: boolean;
  className?: string;
}

export const GenieHeader: React.FC<GenieHeaderProps> = ({
  title,
  subtitle,
  onBack,
  onMenu,
  onNotifications,
  notificationCount = 0,
  right,
  showBrand = false,
  className = '',
}) => {
  const centreBrand = !title && showBrand;

  return (
    <View className={`h-14 w-full flex-row items-center bg-background ${className}`}>
      <View
        className="flex-shrink-0 items-center justify-center"
        style={{ width: 40, height: 40 }}
      >
        {onBack ? (
          <GenieIconButton
            icon={<BackIcon size={24} color={colors.white} />}
            onPress={onBack}
            accessibilityLabel={i18n.t('common:actions.goBack')}
          />
        ) : onMenu ? (
          <GenieIconButton
            icon={<MenuIcon size={24} color={colors.white} />}
            onPress={onMenu}
            accessibilityLabel={i18n.t('common:a11y.openMenu')}
          />
        ) : null}
      </View>

      <View
        className="flex-1 items-center px-2"
        style={{ pointerEvents: 'none' }}
      >
        {title ? (
          <View className="items-center">
            <GenieText variant="screenTitle" numberOfLines={1}>
              {title}
            </GenieText>
            {subtitle ? (
              <GenieText variant="caption" tone="secondary" numberOfLines={1}>
                {subtitle}
              </GenieText>
            ) : null}
          </View>
        ) : centreBrand ? (
          <GenieWordmark size={24} />
        ) : null}
      </View>

      <View className="flex-shrink-0 items-center justify-center">
        {right}
        {onNotifications ? (
          <GenieIconButton
            icon={<BellIcon size={20} color={colors.gold} />}
            onPress={onNotifications}
            accessibilityLabel={i18n.t('common:nav.notifications')}
            badgeCount={notificationCount}
          />
        ) : null}
      </View>
    </View>
  );
};
