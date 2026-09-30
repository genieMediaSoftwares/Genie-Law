import React from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import {
  GenieCard,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieSkeleton,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import { ClockIcon } from '../../../components/icons/ClientIcons';
import { clientApi } from '../../../api/clientApi';
import { formatDate } from '../../../utils/format';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

interface ActivityItem {
  id: string;
  type?: string;
  action?: string;
  title?: string;
  description?: string;
  createdAt?: string;
  date?: string;
  timestamp?: string;
}

export const RecentActivityScreen: React.FC<
  ClientStackScreenProps<'RecentActivity'>
> = ({ navigation }) => {
  const { t } = useT();
  const activityQuery = useQuery({
    queryKey: ['client', 'activity'],
    queryFn: clientApi.getActivity,
  });

  const rawData = activityQuery.data;
  const activities: ActivityItem[] = Array.isArray(rawData)
    ? rawData.map((item: any, idx: number) => ({
        id: item._id || item.id || `act-${idx}`,
        title: item.title || item.action || item.type || t('profile:activity.fallbackTitle'),
        description: item.description || item.message || item.details || '',
        createdAt: item.createdAt || item.date || item.timestamp || '',
        type: item.type || 'system',
      }))
    : [];

  const renderBody = () => {
    if (activityQuery.isPending) {
      return (
        <View className="gap-3 px-4 pt-1">
          <GenieSkeleton className="h-20 w-full rounded-card" />
          <GenieSkeleton className="h-20 w-full rounded-card" />
          <GenieSkeleton className="h-20 w-full rounded-card" />
        </View>
      );
    }

    if (activityQuery.isError) {
      return (
        <View className="px-4">
          <GenieErrorState
            message={activityQuery.error.message}
            onRetry={() => activityQuery.refetch()}
          />
        </View>
      );
    }

    if (activities.length === 0) {
      return (
        <View className="flex-1 justify-center px-4">
          <GenieEmptyState
            title={t('profile:activity.empty')}
            description={t('profile:activity.emptyHint')}
            icon={<ClockIcon size={32} color={colors.gold} />}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={activities}
        keyExtractor={item => item.id}
        contentContainerClassName="px-4 pb-10 pt-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <GenieRefreshControl onRefresh={() => activityQuery.refetch()} />
        }
        renderItem={({ item }) => (
          <GenieCard tone="surface" className="mb-3 flex-row items-start">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gold-muted">
              <ClockIcon size={18} color={colors.gold} />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <GenieText variant="body-sm" className="flex-1 font-semibold">
                  {item.title}
                </GenieText>
                {item.createdAt ? (
                  <GenieText variant="caption" tone="muted" className="ml-2">
                    {formatDate(item.createdAt)}
                  </GenieText>
                ) : null}
              </View>

              {item.description ? (
                <GenieText variant="caption" tone="secondary" className="mt-1">
                  {item.description}
                </GenieText>
              ) : null}
            </View>
          </GenieCard>
        )}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader title={t('profile:activity.title')} onBack={() => navigation.goBack()} />
      {renderBody()}
    </SafeAreaView>
  );
};
