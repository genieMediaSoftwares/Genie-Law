import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import { GenieAvatar, GenieStarRating, GenieText } from '../ui';
import { formatDate } from '../../utils/format';
import type { LawyerReview } from '../../types/domain';
import { useT } from '../../i18n/useT';

export interface ReviewCardProps {
  review: LawyerReview;
  // Shown for the reviewed advocate: lets them answer publicly.
  onReply?: (review: LawyerReview) => void;
  // Flags the review for admin moderation.
  onReport?: (review: LawyerReview) => void;
}

const clientOf = (review: LawyerReview) =>
  typeof review.client === 'object' && review.client ? review.client : null;

export const ReviewCard = memo<ReviewCardProps>(({ review, onReply, onReport }) => {
  const { t } = useT();
  const client = clientOf(review);
  const name = client?.fullName || t('common:reviews.client');

  return (
    <View className="mb-3 rounded-card border border-border bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <GenieAvatar uri={client?.profileImage} name={name} size="md" />

        <View className="min-w-0 flex-1">
          <GenieText variant="body" className="font-semibold" numberOfLines={1}>
            {name}
          </GenieText>
          <View className="mt-1 flex-row items-center gap-2">
            <GenieStarRating value={review.rating} size={13} />
            <GenieText variant="caption" tone="muted">
              {formatDate(review.createdAt)}
            </GenieText>
          </View>
        </View>
      </View>

      <GenieText variant="body-sm" tone="secondary" className="mt-3 leading-5">
        {review.review}
      </GenieText>

      {review.reply ? (
        <View className="mt-3 rounded-control border-l-2 border-border bg-surface-alt p-3">
          <GenieText variant="caption" tone="gold" className="font-bold">
            {t('common:reviews.advocateReply')}
          </GenieText>
          <GenieText variant="body-sm" tone="secondary" className="mt-1 leading-5">
            {review.reply}
          </GenieText>
        </View>
      ) : null}

      {onReply || onReport ? (
        <View className="mt-3 flex-row justify-end gap-4">
          {onReport ? (
            <Pressable
              onPress={() => onReport(review)}
              accessibilityRole="button"
              accessibilityLabel={t('common:reviews.reportA11y')}
              className="min-h-touch justify-center active:opacity-70"
            >
              <GenieText variant="caption" tone={review.isReported ? 'muted' : 'secondary'} className="font-semibold">
                {review.isReported ? t('common:reviews.reported') : t('common:reviews.report')}
              </GenieText>
            </Pressable>
          ) : null}

          {onReply && !review.reply ? (
            <Pressable
              onPress={() => onReply(review)}
              accessibilityRole="button"
              accessibilityLabel={t('common:reviews.replyA11y', { name })}
              className="min-h-touch justify-center active:opacity-70"
            >
              <GenieText variant="caption" tone="gold" className="font-bold">
                {t('common:reviews.reply')}
              </GenieText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

(ReviewCard as React.NamedExoticComponent).displayName = 'ReviewCard';
