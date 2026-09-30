import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieEmptyState,
  GenieErrorState,
  GenieFilterTabs,
  GenieHeader,
  GenieRefreshControl,
  GenieSkeletonList,
  GenieStatusBadge,
  GenieText,
} from '../../../components';
import { GenieCard } from '../../../components/ui/GenieCard';
import { paymentKeys, paymentService, usePaymentStatus } from '../../../api/paymentsApi';
import { PaymentStateNotice, paymentStateTitle } from '../../../components/payments/PaymentStateNotice';
import { toAppError } from '../../../utils/errors';
import type { PaymentRecord } from '../../../types/domain';
import { formatDate } from '../../../utils/format';
import { useT } from '../../../i18n/useT';

type Tab = 'all' | 'completed' | 'pending' | 'refunded';

const TAB_KEYS: ReadonlyArray<Tab> = ['all', 'completed', 'pending', 'refunded'];

// Payment history: the signed-in user's real payments only (client or lawyer).
export const PaymentsScreen: React.FC<{
  navigation: { goBack: () => void; navigate: (screen: 'PaymentDetails', params: { paymentId: string }) => void };
}> = ({ navigation }) => {
  const { t } = useT();
  const TABS = TAB_KEYS.map(key => ({ key, label: t(`payments:history.tabs.${key}`) }));
  const statusQuery = usePaymentStatus();
  const [tab, setTab] = useState<Tab>('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: paymentKeys.history,
    queryFn: paymentService.getPaymentHistory,
  });

  const payments = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    if (tab === 'all') return payments;
    return payments.filter((p) => {
      if (tab === 'refunded') return p.status === 'refunded';
      return p.status === tab;
    });
  }, [payments, tab]);

  const renderItem = ({ item }: { item: PaymentRecord }) => (
    <GenieCard
      className="mb-3"
      onPress={() => navigation.navigate('PaymentDetails', { paymentId: item._id })}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <GenieText variant="body" className="font-semibold">
            {item.lawyer?.fullName ?? t('payments:history.advocate')}
          </GenieText>
          <GenieText variant="caption" tone="muted">
            {item.purpose === 'subscription'
              ? t('payments:history.subscription')
              : t('payments:history.consultation')}
            {item.appointment ? t('payments:history.appointment') : ''}
            {item.case ? t('payments:history.case') : ''}
          </GenieText>
          <GenieText variant="caption" tone="muted" className="mt-1">
            {formatDate(item.createdAt || Date.now())}
          </GenieText>
        </View>
        <View className="items-end">
          <GenieText variant="body" className="font-semibold" tone={item.status === 'refunded' ? 'error' : 'primary'}>
            ₹{item.amount.toLocaleString('en-IN')}
          </GenieText>
          <View className="mt-1">
            <GenieStatusBadge status={paymentStateTitle(item.state)} />
          </View>
        </View>
      </View>
      {item.paymentMethod ? (
        <GenieText variant="caption" tone="muted" className="mt-2">
          {item.paymentMethod}
        </GenieText>
      ) : null}
    </GenieCard>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <GenieHeader title={t('payments:history.title')} onBack={() => navigation.goBack()} />
        <View className="px-4 pt-2">
          <GenieFilterTabs tabs={TABS} value={tab} onChange={setTab} />
        </View>
        <GenieSkeletonList count={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background">
        <GenieHeader title={t('payments:history.title')} onBack={() => navigation.goBack()} />
        <GenieErrorState
          title={t('payments:history.loadFailed')}
          message={toAppError(error).message}
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <GenieHeader title={t('payments:history.title')} onBack={() => navigation.goBack()} />
      <View className="px-4 pt-2">
        <GenieFilterTabs tabs={TABS} value={tab} onChange={setTab} />
      </View>
      {statusQuery.data && !statusQuery.data.paymentsEnabled ? (
        <View className="px-4 pt-3">
          <PaymentStateNotice state="FREE" message={statusQuery.data.message} />
        </View>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListEmptyComponent={
          <GenieEmptyState
            title={t('payments:history.empty')}
            description={
              statusQuery.data && !statusQuery.data.paymentsEnabled
                ? t('payments:history.emptyFree')
                : t('payments:history.emptyHint')
            }
          />
        }
        refreshControl={<GenieRefreshControl onRefresh={() => refetch()} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: filtered.length ? undefined : 1 }}
      />
    </View>
  );
};
