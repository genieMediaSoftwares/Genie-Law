import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import {
  GenieErrorState,
  GenieHeader,
  GenieScreen,
  GenieSkeleton,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import { lawyerApi } from '../../../api/lawyerApi';
import { paymentKeys, paymentService, usePaymentStatus } from '../../../api/paymentsApi';
import { PaymentStateNotice } from '../../../components/payments/PaymentStateNotice';
import { formatAmount } from '../../../types/payments';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { PlanCard } from './PlanCard';
import type { PlanItem } from './types';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

export type { PlanItem };


export const SubscriptionScreen: React.FC<
  LawyerStackScreenProps<'Subscription'>
> = ({ navigation }) => {
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: lawyerApi.getSubscription,
  });

  const statusQuery = usePaymentStatus();
  const plansQuery = useQuery({ queryKey: paymentKeys.plans, queryFn: paymentService.getPlans });
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const header = (
    <GenieHeader title={t('lawyer:subscription.title')} onBack={() => navigation.goBack()} />
  );

  if (subscriptionQuery.isLoading || plansQuery.isLoading || statusQuery.isLoading) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <View className="px-4 py-3">
          <GenieSkeleton className="h-6 w-3/4 mb-4" />
          <GenieSkeleton className="h-36 w-full rounded-card mb-4" />
          <GenieSkeleton className="h-36 w-full rounded-card mb-4" />
          <GenieSkeleton className="h-44 w-full rounded-card" />
        </View>
      </GenieScreen>
    );
  }

  const loadError = subscriptionQuery.error || plansQuery.error || statusQuery.error;
  if (loadError) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <View className="px-4 py-3">
          <GenieErrorState
            title={t('lawyer:subscription.error')}
            message={(loadError as Error).message}
            onRetry={() => {
              subscriptionQuery.refetch();
              plansQuery.refetch();
              statusQuery.refetch();
            }}
          />
        </View>
      </GenieScreen>
    );
  }

  const activePlanName = subscriptionQuery.data?.plan;
  const plans: PlanItem[] = (plansQuery.data ?? []).map(plan => ({
    id: plan.id,
    name: plan.name,
    price: t('payments:checkout.pricePer', {
      price: formatAmount(plan.amountMinor, plan.currency),
      interval: displayLabel('payments:interval', plan.interval),
    }),
    amount: plan.amountMinor / 100,
    popular: plan.popular,
    features: plan.features,
  }));
  const chosenPlanId =
    selectedPlanId ?? plansQuery.data?.find(plan => plan.popular)?.id ?? plans[0]?.id ?? null;

  return (
    <View className="flex-1 bg-background">
      <GenieScreen header={header} dismissKeyboardOnTap={false} padded={false}>
        <View className="flex-1">
          <ScrollView
            className="flex-1 px-4"
            contentContainerClassName="pt-2 pb-32"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <GenieRefreshControl onRefresh={() => subscriptionQuery.refetch()} />
            }
          >
            <GenieText variant="body-md" tone="secondary" className="mb-5 leading-5 font-normal">
              {t('lawyer:subscription.choose')}
            </GenieText>

            {statusQuery.data && !statusQuery.data.paymentsEnabled ? (
              <PaymentStateNotice state="FREE" message={statusQuery.data.message} className="mb-5" />
            ) : null}

            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={chosenPlanId === plan.id}
                isActivePlan={activePlanName === plan.id}
                onPress={() => setSelectedPlanId(plan.id)}
              />
            ))}
          </ScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <Pressable
              onPress={() => {
                if (chosenPlanId) {
                  navigation.navigate('Checkout', { planId: chosenPlanId });
                }
              }}
              disabled={!chosenPlanId}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:subscription.continue')}
              className="h-14 w-full items-center justify-center rounded-control bg-gold active:bg-gold-pressed"
            >
              <GenieText variant="body-lg" tone="on-gold" className="font-bold">
                {t('lawyer:subscription.continue')}
              </GenieText>
            </Pressable>
          </View>
        </View>
      </GenieScreen>
    </View>
  );
};
