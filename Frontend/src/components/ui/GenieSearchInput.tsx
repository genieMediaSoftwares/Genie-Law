import React, { forwardRef } from 'react';
import { Pressable } from 'react-native';
import { GenieInput, GenieInputProps, GenieTextInputRef } from './GenieInput';
import { CloseIcon, SearchIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieSearchInputProps extends Omit<GenieInputProps, 'leftIcon' | 'rightIcon'> {
  onClear?: () => void;
}

export const GenieSearchInput = forwardRef<GenieTextInputRef, GenieSearchInputProps>(
  ({ onClear, value, ...rest }, ref) => (
    <GenieInput
      ref={ref}
      value={value}
      leftIcon={<SearchIcon size={20} color={colors.textMuted} />}
      rightIcon={
        value && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('common:a11y.clearSearch')}
            className="p-1"
          >
            <CloseIcon size={18} color={colors.textMuted} />
          </Pressable>
        ) : undefined
      }
      returnKeyType="search"
      autoCapitalize="none"
      autoCorrect={false}
      {...rest}
    />
  ),
);

GenieSearchInput.displayName = 'GenieSearchInput';
