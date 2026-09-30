import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platform';
import i18n from '../../i18n';

export interface GenieSkeletonProps {
  className?: string;
}

export const GenieSkeleton: React.FC<GenieSkeletonProps> = ({
  className = 'h-5 w-full',
}) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className={`rounded-control bg-skeleton ${className}`}
      accessibilityRole="progressbar"
      accessibilityLabel={i18n.t('common:states.loading')}
    />
  );
};

export const GenieSkeletonCard: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <View className={`rounded-card border border-border bg-card p-4 ${className}`}>
    <GenieSkeleton className="h-4 w-1/2" />
    <GenieSkeleton className="mt-3 h-3 w-full" />
    <GenieSkeleton className="mt-2 h-3 w-4/5" />
  </View>
);

export const GenieSkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <GenieSkeletonCard key={i} className="mb-3" />
    ))}
  </>
);
