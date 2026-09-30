import React from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieRefreshControl,
  GenieSkeletonList,
  GenieStarRating,
  GenieText,
} from '../../../components';
import { GenieCard } from '../../../components/ui/GenieCard';
import { reviewsApi } from '../../../api/reviewsApi';
import { toAppError } from '../../../utils/errors';
import type { LawyerReview } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { formatDate } from '../../../utils/format';
import { useT } from '../../../i18n/useT';

export const ReviewsScreen: React.FC<ClientStackScreenProps<'Reviews'>> = ({ navigation }) => {
  const { t } = useT();
  const { data: reviews, isLoading, error, refetch } = useQuery({
    queryKey: ['reviews', 'mine'],
    queryFn: reviewsApi.listMine,
  });

  const renderItem = ({ item }: { item: LawyerReview }) => (
    <GenieCard className="mb-3">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <GenieText variant="body" className="font-semibold">
            {typeof item.lawyer === 'object' ? item.lawyer.fullName : t('client:reviews.advocate')}
          </GenieText>
          <GenieStarRating value={item.rating} size={14} />
          <GenieText variant="body-sm" className="mt-2">
            {item.review}
          </GenieText>
          {item.reply ? (
            <View className="mt-2 rounded-control bg-surface-secondary p-3">
              <GenieText variant="caption" tone="muted">
                {t('client:reviews.replied', { reply: item.reply })}
              </GenieText>
            </View>
          ) : null}
          <GenieText variant="caption" tone="muted" className="mt-2">
            {formatDate(item.createdAt)}
          </GenieText>
        </View>
      </View>
    </GenieCard>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <GenieHeader title={t('client:reviews.title')} onBack={() => navigation.goBack()} />
        <GenieSkeletonList count={3} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background">
        <GenieHeader title={t('client:reviews.title')} onBack={() => navigation.goBack()} />
        <GenieErrorState
          title={t('client:reviews.loadFailed')}
          message={toAppError(error).message}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <GenieHeader title={t('client:reviews.title')} onBack={() => navigation.goBack()} />
      {reviews && reviews.length > 0 ? (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={<GenieRefreshControl onRefresh={() => refetch()} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      ) : (
        <GenieEmptyState
          title={t('client:reviews.empty')}
          description={t('client:reviews.emptyHint')}
        />
      )}
    </View>
  );
};
