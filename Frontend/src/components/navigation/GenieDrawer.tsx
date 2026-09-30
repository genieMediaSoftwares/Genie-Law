import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GenieAvatar, GenieText, VerifiedBadge } from '../ui';
import {
  ChevronRightIcon,
  CloseIcon,
  LogoutIcon,
  SettingsIcon,
  StarIcon,
} from '../icons/ClientIcons';
import { colors } from '../../theme';
import { USE_NATIVE_DRIVER } from '../../utils/platform';
import { useT } from '../../i18n/useT';

const DRAWER_WIDTH_FRACTION = 0.82;

export interface GenieDrawerItem {
  key?: string;
  id?: string;
  label: string;
  Icon?: React.ComponentType<{ size?: number; color?: string }>;
  icon?: React.ReactNode;
  onPress?: () => void;
  badge?: string | number;
  available?: boolean;
}

export interface GenieDrawerProps {
  isOpen?: boolean;
  visible?: boolean;
  onClose: () => void;
  items: GenieDrawerItem[];
  user?: {
    fullName?: string;
    name?: string;
    email?: string;
    profileImage?: string | null;
    avatar?: string | null;
    isVerified?: boolean;
    role?: string;
  } | null;
  onSettingsPress?: () => void;
  onSignOut?: () => void;
  onLogout?: () => void;
  isSigningOut?: boolean;
  onAvatarPress?: () => void;
  onSubscriptionPress?: () => void;
}

const DrawerRow: React.FC<{
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  badge?: string | number;
}> = ({ label, icon, onPress, disabled = false, destructive = false, badge }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    className={[
      'h-12 flex-row items-center gap-3 rounded-control px-3',
      disabled ? 'opacity-50' : '',
    ].join(' ')}
  >
    <View className="w-6 items-center justify-center">{icon}</View>

    <GenieText
      variant="body-lg"
      tone={destructive ? 'error' : disabled ? 'muted' : 'primary'}
      className="flex-1"
      numberOfLines={1}
    >
      {label}
    </GenieText>

    {badge ? (
      <View className="h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5">
        <GenieText variant="caption" tone="on-gold" className="font-bold">
          {String(badge)}
        </GenieText>
      </View>
    ) : null}

    <ChevronRightIcon
      size={16}
      color={destructive ? colors.error : colors.textMuted}
    />
  </Pressable>
);

export const GenieDrawer: React.FC<GenieDrawerProps> = ({
  isOpen,
  visible,
  onClose,
  items,
  user,
  onSettingsPress,
  onSignOut,
  onLogout,
  isSigningOut = false,
  onAvatarPress,
  onSubscriptionPress,
}) => {
  const isVisible = isOpen ?? visible ?? false;
  const handleLogout = onSignOut ?? onLogout;
  const userName = user?.fullName || user?.name;
  const { t } = useT();
  const roleLabel =
    user?.role === 'lawyer'
      ? t('common:roles.advocate')
      : user?.role === 'client'
      ? t('common:roles.client')
      : '';

  const { width } = useWindowDimensions();
  const drawerWidth = width * DRAWER_WIDTH_FRACTION;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isVisible ? 1 : 0,
      duration: isVisible ? 250 : 200,
      easing: isVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [anim, isVisible]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const menuItems = items.filter(i => (i.key ?? i.id) !== 'settings');
  const settingsItem = items.find(i => (i.key ?? i.id) === 'settings');

  const handleSettings = () => {
    onClose();
    if (settingsItem?.onPress) {
      settingsItem.onPress();
    } else {
      onSettingsPress?.();
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1">
        <Animated.View
          style={{ opacity: anim }}
          className="absolute bottom-0 left-0 right-0 top-0 z-10 bg-overlay"
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common:a11y.closeMenu')}
            className="flex-1"
          />
        </Animated.View>

        <Animated.View
          style={{ transform: [{ translateX }] }}
          className="absolute bottom-0 left-0 top-0 z-20 bg-background"
        >
          <SafeAreaView edges={['top', 'bottom']} className="flex-1">
            <View className="px-4 pb-4 pt-3">
              <View className="flex-row items-center justify-end gap-1">
                {onSubscriptionPress ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onSubscriptionPress();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('common:nav.subscriptionPlans')}
                    className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-secondary"
                  >
                    <StarIcon size={18} color={colors.gold} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('common:a11y.closeMenu')}
                  className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-secondary"
                >
                  <CloseIcon size={20} color={colors.white} />
                </Pressable>
              </View>

              <View className="mt-3 flex-row items-center gap-3">
                <Pressable
                  onPress={() => {
                    if (onAvatarPress) {
                      onClose();
                      onAvatarPress();
                    }
                  }}
                  disabled={!onAvatarPress}
                  accessibilityRole="button"
                  accessibilityLabel={t('common:a11y.viewProfilePhoto')}
                  className="active:opacity-80"
                >
                  <GenieAvatar uri={user?.profileImage || user?.avatar} name={userName} size="profile" />
                </Pressable>

                <View className="flex-1">
                  {userName ? (
                    <View className="flex-row items-center gap-1.5">
                      <GenieText variant="body-lg" className="flex-shrink font-semibold" numberOfLines={1}>
                        {userName}
                      </GenieText>
                      {user?.isVerified ? <VerifiedBadge size={15} /> : null}
                    </View>
                  ) : null}
                  {user?.email ? (
                    <GenieText variant="body-sm" tone="secondary" className="mt-0.5" numberOfLines={1}>
                      {user.email}
                    </GenieText>
                  ) : null}
                  {roleLabel ? (
                    <View className="mt-1.5 self-start rounded-full bg-surface-secondary px-2.5 py-0.5">
                      <GenieText variant="caption" tone="secondary" className="font-medium">
                        {roleLabel}
                      </GenieText>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerClassName="px-4 py-1"
              showsVerticalScrollIndicator={false}
            >
              {menuItems.map(item => {
                const IconComp = item.Icon;
                const isAvailable = item.available !== false;

                return (
                  <DrawerRow
                    key={item.key ?? item.id ?? item.label}
                    label={item.label}
                    disabled={!isAvailable}
                    badge={item.badge}
                    icon={
                      IconComp ? (
                        <IconComp
                          size={20}
                          color={isAvailable ? colors.white : colors.textMuted}
                        />
                      ) : (
                        item.icon ?? null
                      )
                    }
                    onPress={() => {
                      if (item.onPress) {
                        onClose();
                        item.onPress();
                      }
                    }}
                  />
                );
              })}
            </ScrollView>

            <View className="shrink-0 px-4 pb-2">
              <DrawerRow
                label={t('common:nav.settings')}
                icon={<SettingsIcon size={20} color={colors.white} />}
                onPress={handleSettings}
              />

              {handleLogout ? (
                <DrawerRow
                  label={isSigningOut ? t('common:actions.signingOut') : t('common:actions.signOut')}
                  destructive
                  disabled={isSigningOut}
                  icon={<LogoutIcon size={20} color={colors.error} />}
                  onPress={() => {
                    onClose();
                    handleLogout();
                  }}
                />
              ) : null}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};
