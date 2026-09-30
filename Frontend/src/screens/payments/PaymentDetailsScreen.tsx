import React from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { GenieErrorState, GenieHeader, GenieSkeleton, GenieText } from '../../components';
import { GenieCard } from '../../components/ui/GenieCard';
import { PaymentStateNotice } from '../../components/payments/PaymentStateNotice';
import { paymentKeys, paymentService } from '../../api/paymentsApi';
import { toAppError } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import { useT } from '../../i18n/useT';

// One real payment, as stored by the backend. Shows only recorded values.
export const PaymentDetailsScreen: React.FC<{
  navigation: { goBack: () => void };
  route: { params: { paymentId: string } };
}> = ({ navigation, route }) => {
  const { t } = useT();
  const { paymentId } = route.params;
  const query = useQuery({
    queryKey: paymentKeys.detail(paymentId),
    queryFn: () => paymentService.getTransaction(paymentId),
  });

  const header = <GenieHeader title={t('payments:details.title')} onBack={() => navigation.goBack()} />;

  if (query.isLoading) {
    return (
      <View className="flex-1 bg-background">
        {header}
        <View className="px-4 pt-3">
          <GenieSkeleton className="h-24 w-full rounded-card mb-4" />
          <GenieSkeleton className="h-48 w-full rounded-card" />
        </View>
      </View>
    );
  }

  if (query.error || !query.data) {
    return (
      <View className="flex-1 bg-background">
        {header}
        <GenieErrorState
          title={t('payments:details.unavailable')}
          message={query.error ? toAppError(query.error).message : t('payments:details.notFound')}
          onRetry={() => query.refetch()}
        />
      </View>
    );
  }

  const payment = query.data;
  const rows: Array<[string, string | undefined | null]> = [
    [t('payments:details.amount'), `${payment.currency === 'INR' ? '₹' : `${payment.currency} `}${payment.amount.toLocaleString('en-IN')}`],
    [
      t('payments:details.purpose'),
      payment.purpose === 'subscription'
        ? payment.subscriptionPlan
          ? t('payments:details.subscriptionPlan', { plan: payment.subscriptionPlan })
          : t('payments:details.subscription')
        : t('payments:details.consultation'),
    ],
    [t('payments:details.advocate'), payment.lawyer?.fullName],
    [t('payments:details.client'), payment.client?.fullName],
    [t('payments:details.method'), payment.paymentMethod],
    [t('payments:details.gateway'), payment.gateway],
    [t('payments:details.gatewayOrder'), payment.gatewayOrderId],
    [t('payments:details.gatewayPayment'), payment.gatewayPaymentId],
    [t('payments:details.created'), formatDate(payment.createdAt)],
    [t('payments:details.updated'), formatDate(payment.updatedAt)],
    [t('payments:details.failureReason'), payment.failureReason],
  ];

  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView className="flex-1 px-4" contentContainerClassName="pt-2 pb-10">
        <PaymentStateNotice state={payment.state} className="mb-4" />

        <GenieCard className="mb-4">
          {rows
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <View key={label} className="flex-row justify-between py-2">
                <GenieText variant="caption" tone="muted">
                  {label}
                </GenieText>
                <GenieText variant="caption" className="ml-4 flex-1 text-right" numberOfLines={2}>
                  {value}
                </GenieText>
              </View>
            ))}
        </GenieCard>

        <GenieCard>
          <GenieText variant="body" className="font-semibold">
            {t('payments:details.receipt')}
          </GenieText>
          <GenieText variant="caption" tone="secondary" className="mt-1">
            {t('payments:details.receiptSoon')}
          </GenieText>
        </GenieCard>
      </ScrollView>
    </View>
  );
};
