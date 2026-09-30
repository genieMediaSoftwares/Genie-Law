import React from 'react';
import { Pressable, View } from 'react-native';
import { GenieText } from './GenieText';
import { ChevronRightIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';

export interface GenieSettingsRowProps {
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger' | 'warning';
  disabled?: boolean;
  className?: string;
  testID?: string;
}

export const GenieSettingsRow: React.FC<GenieSettingsRowProps> = ({
  label,
  subtitle,
  icon,
  value,
  trailing,
  onPress,
  tone = 'default',
  disabled = false,
  className = '',
  testID,
}) => {
  const labelTone =
    tone === 'danger' ? 'error' : tone === 'warning' ? 'warning' : 'primary';
  const chevronColor =
    tone === 'danger'
      ? colors.error
      : tone === 'warning'
      ? colors.warning
      : colors.textMuted;

  const Container = onPress ? Pressable : View;

  return (
    <Container
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        value ? `${label}, ${value}` : subtitle ? `${label}. ${subtitle}` : label
      }
      accessibilityState={onPress ? { disabled } : undefined}
      className={[
        'min-h-[56px] flex-row items-center px-4 py-3',
        onPress ? 'active:bg-surface-alt' : '',
        disabled ? 'opacity-50' : '',
        className,
      ].join(' ')}
    >
      {icon ? (
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-surface-secondary">
          {icon}
        </View>
      ) : null}

      <View className="flex-1 justify-center">
        <GenieText variant="body" tone={labelTone} className="text-body font-semibold">
          {label}
        </GenieText>
        {subtitle ? (
          <GenieText variant="secondary" tone="muted" className="mt-0.5">
            {subtitle}
          </GenieText>
        ) : null}
      </View>

      {value ? (
        <GenieText variant="secondary" tone="secondary" className="ml-2">
          {value}
        </GenieText>
      ) : null}

      {trailing ?? (onPress ? <ChevronRightIcon size={18} color={chevronColor} /> : null)}
    </Container>
  );
};

export const GenieSettingsGroup: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => {
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View className={className}>
      <GenieText
        variant="caption"
        tone="muted"
        className="mb-2 ml-1 font-bold tracking-widest"
      >
        {title}
      </GenieText>
      <View className="overflow-hidden rounded-card border border-border bg-surface">
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View className="ml-4 h-px bg-border" /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
};
