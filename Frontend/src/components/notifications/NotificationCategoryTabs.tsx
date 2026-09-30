import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { GenieText } from '../ui/GenieText';
import {
  BellIcon,
  BriefcaseIcon,
  ChatIcon,
  FileIcon,
} from '../icons/ClientIcons';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

export type NotificationCategory =
  | 'All'
  | 'Cases'
  | 'Messages'
  | 'Documents'
  | 'Updates';

interface NotificationCategoryTabsProps {
  selectedTab: NotificationCategory;
  onSelectTab: (tab: NotificationCategory) => void;
  counts: Record<NotificationCategory, number>;
}

const TABS = [
  { key: 'All', labelKey: 'notifications:tabs.all', icon: BellIcon },
  { key: 'Cases', labelKey: 'notifications:tabs.cases', icon: BriefcaseIcon },
  { key: 'Messages', labelKey: 'notifications:tabs.messages', icon: ChatIcon },
  { key: 'Documents', labelKey: 'notifications:tabs.documents', icon: FileIcon },
  { key: 'Updates', labelKey: 'notifications:tabs.updates', icon: BellIcon },
] as const satisfies ReadonlyArray<{
  key: NotificationCategory;
  labelKey: string;
  icon: React.FC<{ size?: number; color?: string }>;
}>;

export const NotificationCategoryTabs: React.FC<NotificationCategoryTabsProps> = ({
  selectedTab,
  onSelectTab,
  counts,
}) => {
  const { t } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 py-2 gap-2"
    >
      {TABS.map(({ key, labelKey, icon: IconComponent }) => {
        const isSelected = selectedTab === key;
        const count = counts[key] || 0;

        return (
          <Pressable
            key={key}
            onPress={() => onSelectTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            className={`min-h-touch flex-row items-center gap-2 rounded-pill px-3.5 ${
              isSelected ? 'bg-gold' : 'border border-border bg-surface active:bg-surface-secondary'
            }`}
          >
            <IconComponent
              size={16}
              color={isSelected ? colors.onGold : colors.textMuted}
            />

            <GenieText
              tone={isSelected ? 'on-gold' : 'secondary'}
              className="text-xs font-semibold"
            >
              {t(labelKey)}
            </GenieText>

            {count > 0 ? (
              <View
                className={`h-4 min-w-[16px] items-center justify-center rounded-full px-1 ${
                  isSelected ? 'bg-gold-pressed' : 'bg-surface-secondary'
                }`}
              >
                <GenieText
                  tone={isSelected ? 'on-gold' : 'secondary'}
                  className="text-small-label font-bold"
                >
                  {count}
                </GenieText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
