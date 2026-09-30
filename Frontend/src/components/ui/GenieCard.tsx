import React from 'react';
import { Pressable, View, ViewProps } from 'react-native';

export type GenieCardTone = 'card' | 'surface' | 'alt' | 'elevated';

const TONES: Record<GenieCardTone, string> = {
  card: 'bg-card border border-border',
  surface: 'bg-surface border border-border',
  alt: 'bg-surface-alt border border-border',
  elevated: 'bg-card border border-border',
};

export interface GenieCardProps extends ViewProps {
  children: React.ReactNode;
  tone?: GenieCardTone;
  padded?: boolean;
  onPress?: () => void;
  className?: string;
  accessibilityLabel?: string;
}

export const GenieCard: React.FC<GenieCardProps> = ({
  children,
  tone = 'card',
  padded = true,
  onPress,
  className = '',
  accessibilityLabel,
  ...rest
}) => {
  const classes = `rounded-[12px] ${TONES[tone]} ${padded ? 'p-4' : ''} ${className}`;

  const pressableContent = (
    <View className={classes}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={`active:opacity-80 ${tone === 'elevated' ? 'active:bg-card' : ''}`}
        {...rest}
      >
        {pressableContent}
      </Pressable>
    );
  }

  return (
    <View className={classes} {...rest}>
      {children}
    </View>
  );
};
