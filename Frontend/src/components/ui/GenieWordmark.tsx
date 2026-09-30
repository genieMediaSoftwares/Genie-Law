import React from 'react';
import { View } from 'react-native';
import { GenieText } from './GenieText';

export interface GenieWordmarkProps {
  size?: number;
  stacked?: boolean;
  className?: string;
}

export const GenieWordmark: React.FC<GenieWordmarkProps> = ({
  stacked = false,
  className = '',
}) => (
  <View
    className={`${stacked ? 'items-center' : 'flex-row items-center'} ${className}`}
    accessibilityRole="header"
    accessibilityLabel="Genie Law"
  >
    <GenieText variant="brand">
      GENIE <GenieText variant="brand" tone="gold">LAW</GenieText>
    </GenieText>
  </View>
);
