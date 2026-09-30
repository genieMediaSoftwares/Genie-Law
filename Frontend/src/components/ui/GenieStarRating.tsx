import React from 'react';
import { Pressable, View } from 'react-native';
import { StarIcon } from '../icons/ClientIcons';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface GenieStarRatingProps {
  value: number;
  // Omit to render a read-only rating.
  onChange?: (rating: number) => void;
  size?: number;
  className?: string;
}

const STARS = [1, 2, 3, 4, 5];

// The one star rating control: read-only when no `onChange` is given, tappable
// 1-5 input when it is.
export const GenieStarRating: React.FC<GenieStarRatingProps> = ({
  value,
  onChange,
  size = 16,
  className = '',
}) => (
  <View
    className={`flex-row items-center gap-1 ${className}`}
    accessibilityRole={onChange ? 'adjustable' : 'image'}
    accessibilityLabel={i18n.t('common:a11y.starsOutOfFive', { value })}
  >
    {STARS.map(star => {
      const filled = star <= Math.round(value);
      // StarIcon is a solid shape; filled vs empty is the colour.
      const icon = (
        <StarIcon size={size} color={filled ? colors.gold : colors.border} />
      );

      if (!onChange) {
        return <View key={star}>{icon}</View>;
      }

      return (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common:a11y.rateStars', { count: star })}
          accessibilityState={{ selected: star === value }}
          hitSlop={6}
          className="p-1 active:opacity-70"
        >
          {icon}
        </Pressable>
      );
    })}
  </View>
);
