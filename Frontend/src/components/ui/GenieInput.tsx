import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { GenieText } from './GenieText';
import { colors } from '../../theme';

export type GenieTextInputRef = React.ComponentRef<typeof TextInput>;

export interface GenieInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
  className?: string;
}

export const GenieInput = forwardRef<GenieTextInputRef, GenieInputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      containerClassName = '',
      className = '',
      onFocus,
      onBlur,
      editable = true,
      ...rest
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const innerRef = useRef<GenieTextInputRef>(null);

    useImperativeHandle(ref, () => innerRef.current as GenieTextInputRef);

    const hasError = Boolean(error);
    const helper = error ?? helperText;

    const focusInput = () => {
      if (editable) {
        innerRef.current?.focus();
      }
    };

    let borderClass = 'border-border';
    if (hasError) {
      borderClass = 'border-error';
    } else if (isFocused) {
      borderClass = 'border-focus';
    }

    const fieldClasses = [
      'h-12 flex-row items-center rounded-control border bg-surface px-3.5',
      borderClass,
      editable ? '' : 'opacity-50',
    ].join(' ');

    const field = (
      <>
        {leftIcon ? (
          <View className="mr-2.5 items-center justify-center" style={{ pointerEvents: 'none' }}>
            {leftIcon}
          </View>
        ) : null}
        <TextInput
          ref={innerRef}
          editable={editable}
          placeholderTextColor={colors.textMuted}
          className={`h-full flex-1 text-body text-white ${className}`}
          style={webInputReset}
          accessibilityLabel={label}
          onFocus={e => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon ? <View className="ml-2 items-center justify-center">{rightIcon}</View> : null}
      </>
    );

    return (
      <View className={`w-full ${containerClassName}`}>
        {label ? (
          <GenieText variant="label" className="mb-1.5">
            {label}
          </GenieText>
        ) : null}

        {Platform.OS === 'web' ? (
          <View className={fieldClasses}>{field}</View>
        ) : (
          <Pressable className={fieldClasses} onPress={focusInput}>
            {field}
          </Pressable>
        )}

        {helper ? (
          <GenieText
            variant="caption"
            tone={hasError ? 'error' : 'muted'}
            className="mt-1"
          >
            {helper}
          </GenieText>
        ) : null}
      </View>
    );
  },
);

GenieInput.displayName = 'GenieInput';

const webInputReset = StyleSheet.create({
  reset: Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
}).reset;
