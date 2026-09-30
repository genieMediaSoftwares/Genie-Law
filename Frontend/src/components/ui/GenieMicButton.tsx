import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import type { PressableProps } from 'react-native';
import { MicIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';

export interface GenieMicButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  onPress: () => void;
  accessibilityLabel: string;
  isRecording: boolean;
  // True while a recording is being transcribed; shows a spinner in place
  // of the mic icon and is distinct from `disabled` (still announces busy).
  isBusy?: boolean;
  className?: string;
}

/**
 * The one microphone control used everywhere in the app: a compact 48×48
 * circle — solid yellow when idle, solid error-red while recording — with a
 * centered 22px black mic icon. Keep every voice-input entry point on this
 * component so the control never grows oversized on just one screen again.
 */
export const GenieMicButton: React.FC<GenieMicButtonProps> = ({
  onPress,
  accessibilityLabel,
  isRecording,
  isBusy = false,
  disabled = false,
  className = '',
  ...rest
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ busy: isBusy, disabled: Boolean(disabled) }}
    className={[
      'h-12 w-12 items-center justify-center rounded-full',
      isRecording ? 'bg-error' : 'bg-gold',
      disabled ? 'opacity-40' : 'active:opacity-80',
      className,
    ].join(' ')}
    {...rest}
  >
    {isBusy ? (
      <ActivityIndicator size="small" color={colors.background} />
    ) : (
      <MicIcon size={22} color={colors.background} />
    )}
  </Pressable>
);
