import React, { useEffect, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieBottomSheet,
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieNotice,
  GenieRefreshControl,
  GenieSkeletonList,
  GenieStarRating,
  GenieText,
  ReviewCard,
} from '../../../components';
import { reviewsApi } from '../../../api/reviewsApi';
import { toAppError } from '../../../utils/errors';
import type { LawyerReview } from '../../../types/domain';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

const MAX_REPLY = 1000;

export const LawyerReviewsScreen: React.FC<
  LawyerStackScreenProps<'LawyerReviews'>
> = ({ navigation }) => {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<LawyerReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ['reviews', 'mine'],
    queryFn: reviewsApi.listMine,
  });

  const reply = useMutation({
    mutationFn: (input: { id: string; text: string }) =>
      reviewsApi.reply(input.id, input.text),
    onSuccess: async () => {
      setReplyingTo(null);
      setReplyError(null);
      await queryClient.invalidateQueries({ queryKey: ['reviews', 'mine'] });
    },
    onError: error => setReplyError(toAppError(error).message),
  });

  // Start each reply from a clean draft.
  useEffect(() => {
    if (replyingTo) {
      setReplyText('');
      setReplyError(null);
    }
  }, [replyingTo]);

  const reviews = reviewsQuery.data ?? [];
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
      : 0;

  const header = (
    <GenieHeader title={t('lawyer:reviews.title')} onBack={() => navigation.goBack()} />
  );

  const renderBody = () => {
    if (reviewsQuery.isPending) {
      return (
        <View className="px-4 pt-3">
          <GenieSkeletonList count={3} />
        </View>
      );
    }

    if (reviewsQuery.isError) {
      return (
        <View className="px-4 pt-3">
          <GenieErrorState
            message={reviewsQuery.error.message}
            onRetry={() => reviewsQuery.refetch()}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={reviews}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <ReviewCard review={item} onReply={setReplyingTo} />
        )}
        contentContainerClassName="px-4 pb-10 pt-1"
        contentContainerStyle={
          reviews.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          reviews.length === 0 ? undefined : (
            <View className="mb-4 flex-row items-center gap-3 rounded-card border border-border bg-surface p-4">
              <GenieText variant="stat" tone="gold">
                {averageRating.toFixed(1)}
              </GenieText>
              <View>
                <GenieStarRating value={averageRating} size={14} />
                <GenieText variant="caption" tone="muted" className="mt-1">
                  {t('lawyer:reviews.count', { count: reviews.length })}
                </GenieText>
              </View>
            </View>
          )
        }
        ListEmptyComponent={
          <GenieEmptyState
            title={t('lawyer:reviews.empty')}
            description={t('lawyer:reviews.emptyHint')}
          />
        }
        refreshControl={
          <GenieRefreshControl onRefresh={() => reviewsQuery.refetch()} />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {header}
      {renderBody()}

      <GenieBottomSheet
        visible={Boolean(replyingTo)}
        onClose={() => {
          setReplyingTo(null);
          setReplyError(null);
        }}
        title={t('lawyer:reviews.replyTitle')}
        footer={
          <GenieButton
            label={t('lawyer:reviews.post')}
            loadingLabel={t('lawyer:reviews.posting')}
            loading={reply.isPending}
            disabled={!replyText.trim() || reply.isPending}
            onPress={() =>
              replyingTo &&
              reply.mutate({ id: replyingTo._id, text: replyText.trim() })
            }
          />
        }
      >
        <View className="pb-2">
          <GenieText variant="body-sm" tone="secondary">
            {t('lawyer:reviews.publicNote')}
          </GenieText>

          <TextInput
            value={replyText}
            onChangeText={text => setReplyText(text.slice(0, MAX_REPLY))}
            placeholder={t('lawyer:reviews.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            accessibilityLabel={t('lawyer:reviews.replyA11y')}
            className="mt-3 min-h-[110px] rounded-control border border-border bg-card px-4 py-3 text-body-md text-white"
          />

          {replyError ? (
            <GenieNotice tone="error" message={replyError} className="mt-3" />
          ) : null}
        </View>
      </GenieBottomSheet>
    </SafeAreaView>
  );
};
