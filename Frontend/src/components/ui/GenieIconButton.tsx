import React from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import { GenieText } from './GenieText';

export interface GenieIconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  badgeCount?: number;
  className?: string;
}

export const GenieIconButton: React.FC<GenieIconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  badgeCount = 0,
  className = '',
  ...rest
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    className={`h-[40px] w-[40px] items-center justify-center rounded-full active:bg-surface-alt ${className}`}
    {...rest}
  >
    {icon}
    {badgeCount > 0 ? (
      <View className="absolute right-1.5 top-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-error px-1">
        <GenieText variant="caption" className="text-small-label font-bold">
          {badgeCount > 99 ? '99+' : String(badgeCount)}
        </GenieText>
      </View>
    ) : null}
  </Pressable>
);
