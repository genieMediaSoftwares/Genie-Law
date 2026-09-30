import React, { forwardRef, useState } from 'react';
import { Pressable } from 'react-native';
import { GenieInput, GenieInputProps, GenieTextInputRef } from './GenieInput';
import { EyeIcon, EyeOffIcon, LockIcon } from '../icons/Icons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export type GeniePasswordInputProps = Omit<GenieInputProps, 'secureTextEntry'>;

export const GeniePasswordInput = forwardRef<GenieTextInputRef, GeniePasswordInputProps>(
  ({ leftIcon, ...rest }, ref) => {
    const [secure, setSecure] = useState(true);

    return (
      <GenieInput
        ref={ref}
        leftIcon={leftIcon ?? <LockIcon size={20} color={colors.textMuted} />}
        rightIcon={
          <Pressable
            onPress={() => setSecure(prev => !prev)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              secure ? i18n.t('common:a11y.showPassword') : i18n.t('common:a11y.hidePassword')
            }
            className="p-1"
          >
            {secure ? (
              <EyeIcon size={20} color={colors.textMuted} />
            ) : (
              <EyeOffIcon size={20} color={colors.gold} />
            )}
          </Pressable>
        }
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
    );
  },
);

GeniePasswordInput.displayName = 'GeniePasswordInput';
