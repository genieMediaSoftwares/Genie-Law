import React from 'react';
import { View } from 'react-native';
import { GenieSkeleton } from '../ui';

export const DocumentSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <View className="px-5 py-2 gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className="flex-row items-center rounded-card border border-border bg-surface p-3.5"
        >
          <GenieSkeleton className="h-11 w-11 rounded-lg" />
          <View className="ml-3 flex-1 gap-2">
            <GenieSkeleton className="h-4 w-3/4 rounded-md" />
            <GenieSkeleton className="h-3 w-1/2 rounded-md" />
          </View>
        </View>
      ))}
    </View>
  );
};
