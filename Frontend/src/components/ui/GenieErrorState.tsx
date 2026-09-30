import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';
import { GenieButton } from './GenieButton';
import i18n from '../../i18n';

export interface GenieErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const GenieErrorState: React.FC<GenieErrorStateProps> = ({
  title = i18n.t('common:errors.somethingWentWrong'),
  message,
  onRetry,
  retryLabel = i18n.t('common:actions.tryAgain'),
  className = '',
}) => (
  <View
    className={`items-center justify-center rounded-card border border-border bg-surface p-5 ${className}`}
    accessibilityRole="alert"
  >
    <GenieText variant="heading-sm" tone="error" className="text-center">
      {title}
    </GenieText>
    <GenieText variant="body-md" tone="secondary" className="mt-2 text-center">
      {message}
    </GenieText>
    {onRetry ? (
      <GenieButton
        label={retryLabel}
        onPress={onRetry}
        variant="outline"
        fullWidth={false}
        className="mt-4"
      />
    ) : null}
  </View>
);
