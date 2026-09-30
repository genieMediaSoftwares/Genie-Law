import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, View } from 'react-native';
import { GenieText } from './GenieText';
import { colors } from '../../theme';
import { elevation } from '../../theme/spacing';

export type GenieButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
export type GenieButtonSize = 'sm' | 'md';

const CONTAINER: Record<GenieButtonVariant, string> = {
  primary: 'bg-gold active:bg-gold-pressed',
  secondary: 'bg-surface-secondary active:bg-border',
  // Neutral outline: gold is reserved for filled primary buttons.
  outline: 'bg-transparent border border-border active:bg-surface-secondary',
  ghost: 'bg-transparent active:bg-surface-alt',
  danger: 'bg-error active:opacity-80',
  gold: 'bg-gold active:bg-gold-pressed',
};

const LABEL_TONE: Record<GenieButtonVariant, 'on-gold' | 'gold' | 'primary'> = {
  primary: 'on-gold',
  secondary: 'primary',
  outline: 'primary',
  ghost: 'primary',
  danger: 'primary',
  gold: 'on-gold',
};

const SIZES: Record<GenieButtonSize, { container: string; radius: string; gap: string }> = {
  sm: { container: 'h-[36px] px-4', radius: 'rounded-[8px]', gap: 'gap-1.5' },
  md: { container: 'h-[50px] px-5', radius: 'rounded-[10px]', gap: 'gap-2' },
};

export interface GenieButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  onPress: () => void;
  variant?: GenieButtonVariant;
  size?: GenieButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

export const GenieButton: React.FC<GenieButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = true,
  icon,
  iconPosition = 'left',
  className = '',
  ...rest
}) => {
  const isInactive = disabled || loading;
  const displayLabel = loading ? loadingLabel ?? label : label;
  const config = SIZES[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      className={[
        'flex-row items-center justify-center',
        config.radius,
        config.container,
        CONTAINER[variant],
        fullWidth ? 'w-full' : 'self-center',
        isInactive ? 'opacity-50' : '',
        config.gap,
        className,
      ].join(' ')}
      style={variant === 'primary' && !isInactive ? elevation.gold : undefined}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.onGold : colors.gold}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' ? (
            <View className="items-center justify-center">{icon}</View>
          ) : null}
          <GenieText
            variant={size === 'sm' ? 'secondary' : 'button'}
            tone={LABEL_TONE[variant]}
            className="font-semibold"
          >
            {displayLabel}
          </GenieText>
          {icon && iconPosition === 'right' ? (
            <View className="items-center justify-center">{icon}</View>
          ) : null}
        </>
      )}
    </Pressable>
  );
};
