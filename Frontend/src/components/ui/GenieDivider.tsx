import React from 'react';
import { View } from 'react-native';

export const GenieDivider: React.FC<{ className?: string }> = ({
  className = '',
}) => <View className={`h-px w-full bg-border ${className}`} />;
