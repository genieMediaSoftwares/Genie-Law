import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { GenieText } from './GenieText';

export interface GenieFilterTab<K extends string> {
  key: K;
  label: string;
  // Real counts only; omit while the data is loading.
  count?: number;
  icon?: React.ReactNode;
}

export interface GenieFilterTabsProps<K extends string> {
  tabs: ReadonlyArray<GenieFilterTab<K>>;
  value: K;
  onChange: (key: K) => void;
  // Stretch tabs to fill the row (few tabs) or scroll horizontally (many).
  // 'inline' keeps each tab at its natural width.
  layout?: 'fill' | 'scroll' | 'inline';
  className?: string;
  testIDPrefix?: string;
}

// Solid tabs: the active one is filled yellow with black text; the rest are
// dark with gray text. No outlines.
export function GenieFilterTabs<K extends string>({
  tabs,
  value,
  onChange,
  layout = 'fill',
  className = '',
  testIDPrefix,
}: GenieFilterTabsProps<K>) {
  const items = tabs.map(tab => {
    const active = tab.key === value;
    return (
      <Pressable
        key={tab.key}
        testID={testIDPrefix ? `${testIDPrefix}-${tab.key}` : undefined}
        onPress={() => onChange(tab.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={tab.count === undefined ? tab.label : `${tab.label}, ${tab.count}`}
        className={[
          'h-[44px] flex-row items-center justify-center gap-1.5 rounded-[10px] px-4 border',
          layout === 'fill' ? 'flex-1' : '',
          active ? 'bg-gold border-gold' : 'bg-surface border-border active:bg-surface-secondary',
        ].join(' ')}
      >
        {tab.icon}
        <GenieText
          variant="button"
          tone={active ? 'on-gold' : 'secondary'}
          className="font-semibold"
          numberOfLines={1}
        >
          {tab.label}
        </GenieText>
        {tab.count !== undefined ? (
          <View
            className={`min-w-[20px] items-center rounded-[8px] px-1.5 py-0.5 ${
              active ? 'bg-gold-pressed' : 'bg-surface-secondary'
            }`}
          >
            <GenieText
              variant="smallLabel"
              tone={active ? 'on-gold' : 'muted'}
              className="font-bold"
            >
              {String(tab.count)}
            </GenieText>
          </View>
        ) : null}
      </Pressable>
    );
  });

  if (layout === 'scroll') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName={`gap-2 ${className}`}
      >
        {items}
      </ScrollView>
    );
  }

  return <View className={`flex-row gap-2 ${className}`}>{items}</View>;
}
