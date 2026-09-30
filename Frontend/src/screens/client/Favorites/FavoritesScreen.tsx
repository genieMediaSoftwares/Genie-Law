import React, { useCallback } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAdvocateCard,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieSkeleton,
  GenieRefreshControl,
} from '../../../components';
import { HeartIcon } from '../../../components/icons/ClientIcons';
import { favoritesApi } from '../../../api/advocatesApi';
import type { FavoriteEntry, LawyerProfile } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

export const FavoritesScreen: React.FC<ClientStackScreenProps<'Favorites'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: favoritesApi.list,
  });

  const toggleFavorite = useMutation({
    mutationFn: (userId: string) => favoritesApi.toggle(userId),
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<FavoriteEntry[]>(['favorites']);

      queryClient.setQueryData<FavoriteEntry[]>(['favorites'], current =>
        (current ?? []).filter(entry => entry.lawyer?._id !== userId),
      );

      return { previous };
    },
    onError: (_error, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const openAdvocate = useCallback(
    (userId: string) => navigation.navigate('AdvocateProfile', { userId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: FavoriteEntry }) => {
      if (!item.profile || !item.lawyer) {
        return null;
      }

      const merged: LawyerProfile = { ...item.profile, user: item.lawyer };

      return (
        <GenieAdvocateCard
          item={merged}
          onPress={openAdvocate}
          isFavorite
          onToggleFavorite={userId => toggleFavorite.mutate(userId)}
        />
      );
    },
    [openAdvocate, toggleFavorite],
  );

  const entries = favoritesQuery.data ?? [];
  const isEmpty = entries.length === 0;

  const renderBody = () => {
    if (favoritesQuery.isPending) {
      return (
        <View className="mt-1 gap-3 px-4">
          <GenieSkeleton className="h-24 w-full rounded-card" />
          <GenieSkeleton className="h-24 w-full rounded-card" />
          <GenieSkeleton className="h-24 w-full rounded-card" />
        </View>
      );
    }

    if (favoritesQuery.isError) {
      return (
        <View className="px-4">
          <GenieErrorState
            message={favoritesQuery.error.message}
            onRetry={() => favoritesQuery.refetch()}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        contentContainerClassName="px-4 pb-10"
        contentContainerStyle={
          isEmpty ? { flexGrow: 1, justifyContent: 'center' } : undefined
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews
        refreshControl={
          <GenieRefreshControl onRefresh={() => favoritesQuery.refetch()} />
        }
        ListEmptyComponent={
          <GenieEmptyState
            icon={<HeartIcon size={28} color={colors.gold} />}
            title={t('client:favorites.empty')}
            description={t('client:favorites.emptyHint')}
            actionLabel={t('client:favorites.browse')}
            onAction={() => navigation.navigate('Tabs')}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('client:favorites.title')}
        onBack={() => navigation.goBack()}
      />
      {renderBody()}
    </SafeAreaView>
  );
};
