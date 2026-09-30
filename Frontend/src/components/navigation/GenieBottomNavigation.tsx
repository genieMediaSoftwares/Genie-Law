import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { GenieText } from '../ui';
import {
  BriefcaseIcon,
  HomeIcon,
  PlusIcon,
  ScalesIcon,
} from '../icons/ClientIcons';
import { UserIcon } from '../icons/Icons';
import { useUiStore } from '../../store/uiStore';
import { colors } from '../../theme';
import { elevation } from '../../theme/spacing';
import { useT } from '../../i18n/useT';
import { navLabel } from '../../i18n/navLabels';

const ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Home: HomeIcon,
  Cases: BriefcaseIcon,
  Advocates: ScalesIcon,
  Profile: UserIcon,
};

export const GenieBottomNavigation: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { t } = useT();
  const openCreateSheet = useUiStore(s => s.openCreateSheet);
  const insets = useSafeAreaInsets();

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.findIndex(r => r.key === route.key);
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;

    const label = navLabel(t, route.name);

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const Icon = ICONS[route.name] ?? HomeIcon;

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        className="min-h-touch flex-1 items-center justify-center py-2"
      >
        <View className="items-center">
          <Icon size={22} color={isFocused ? colors.gold : colors.textMuted} />
          <GenieText
            variant="label"
            tone={isFocused ? 'gold' : 'muted'}
            className={`mt-1 ${isFocused ? 'font-semibold' : 'font-normal'}`}
            numberOfLines={1}
          >
            {label}
          </GenieText>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="bg-background" style={{ paddingBottom: insets.bottom }}>
      <View className="h-14 flex-row items-center">
        <View className="flex-1 flex-row items-center justify-around">
          {state.routes.slice(0, 2).map(renderTab)}
        </View>

        <View className="w-12" style={{ pointerEvents: 'none' }} />

        <View className="flex-1 flex-row items-center justify-around">
          {state.routes.slice(2).map(renderTab)}
        </View>
      </View>

      <Pressable
        onPress={openCreateSheet}
        accessibilityRole="button"
        accessibilityLabel={t('common:nav.postYourCase')}
        className="absolute left-1/2 h-12 w-12 items-center justify-center rounded-full bg-gold active:bg-gold-pressed"
        style={[
          styles.centreButton,
          { bottom: insets.bottom + 12 },
        ]}
      >
        <PlusIcon size={24} color={colors.onGold} />
      </Pressable>
    </View>
  );
};

const styles = {
  centreButton: {
    transform: [{ translateX: -24 }],
    ...Platform.select({
      ios: elevation.goldLg,
      android: elevation.goldLg,
      web: { boxShadow: '0px 4px 12px rgba(245, 185, 0, 0.35)' } as any,
    }),
    zIndex: 20,
  },
};
