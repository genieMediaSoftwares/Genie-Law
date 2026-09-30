import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface GenieScreenProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  scrollable?: boolean;
  edges?: ReadonlyArray<'top' | 'bottom' | 'left' | 'right'>;
  padded?: boolean;
  dismissKeyboardOnTap?: boolean;
  className?: string;
  containerClassName?: string;
  contentContainerClassName?: string;
  scrollViewProps?: Omit<ScrollViewProps, 'children'>;
}

export const GenieScreen: React.FC<GenieScreenProps> = ({
  children,
  scrollable = false,
  edges = ['top'],
  padded = true,
  dismissKeyboardOnTap = true,
  header,
  className = '',
  containerClassName = '',
  contentContainerClassName = '',
  scrollViewProps,
}) => {
  const gutter = padded ? 'px-4' : '';

  const content = scrollable ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={`${gutter} pb-6 pt-3 ${contentContainerClassName}`}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={true}
      decelerationRate="normal"
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 ${gutter} py-3 ${className}`}>{children}</View>
  );

  const body =
    dismissKeyboardOnTap && Platform.OS !== 'web' ? (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View className="flex-1">{content}</View>
      </TouchableWithoutFeedback>
    ) : (
      content
    );

  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 bg-background ${containerClassName}`}
    >
      {header}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
