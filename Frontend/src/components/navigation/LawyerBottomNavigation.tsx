import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { GenieText } from '../ui';
import { UserIcon } from '../icons/Icons';
import {
  CalendarIcon,
  ChartIcon,
  GridIcon,
  UserPlusIcon,
  UsersIcon,
} from '../icons/LawyerIcons';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';
import { navLabel } from '../../i18n/navLabels';

const ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Workspace: GridIcon,
  Dashboard: ChartIcon,
  Leads: UserPlusIcon,
  Clients: UsersIcon,
  Calendar: CalendarIcon,
  LawyerProfile: UserIcon,
};

export const LawyerBottomNavigation: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useT();

  return (
    <View
      className="bg-background"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="h-[56px] flex-row items-center">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = navLabel(t, route.name);
          const Icon = ICONS[route.name] ?? GridIcon;

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

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              className="min-h-touch flex-1 items-center justify-center px-0.5 py-2"
            >
              <Icon size={22} color={isFocused ? colors.gold : colors.textMuted} />
              <GenieText
                variant="label"
                tone={isFocused ? 'gold' : 'muted'}
                className={`mt-1 ${isFocused ? 'font-semibold' : 'font-normal'}`}
                numberOfLines={1}
              >
                {label}
              </GenieText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
