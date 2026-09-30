import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieButton,
  GenieErrorState,
  GenieHeader,
  GenieSkeleton,
  GenieText,
} from '../../components';
import { GenieCard } from '../../components/ui/GenieCard';
import { PaymentStateNotice } from '../../components/payments/PaymentStateNotice';
import { paymentKeys, paymentService, usePaymentStatus } from '../../api/paymentsApi';
import { clientPaymentGateway } from '../../services/paymentGateway';
import { toAppError } from '../../utils/errors';
import { formatAmount } from '../../types/payments';
import type { PaymentState } from '../../types/payments';
import type { LawyerStackScreenProps } from '../../types/navigation';
import { useT } from '../../i18n/useT';
import { displayLabel } from '../../i18n/labels';

// Checkout for a subscription plan. The screen never decides that a payment
// succeeded: it starts one through the backend, hands it to the gateway, and
// shows the state the backend reports after verifying it.
export const CheckoutScreen: React.FC<LawyerStackScreenProps<'Checkout'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const { planId } = route.params;
  const queryClient = useQueryClient();
  const statusQuery = usePaymentStatus();
  const plansQuery = useQuery({ queryKey: paymentKeys.plans, queryFn: paymentService.getPlans });
  const [flowState, setFlowState] = useState<PaymentState | null>(null);
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);

  const header = <GenieHeader title={t('payments:checkout.title')} onBack={() => navigation.goBack()} />;

  if (statusQuery.isLoading || plansQuery.isLoading) {
    return (
      <View className="flex-1 bg-background">
        {header}
        <View className="px-4 pt-3">
          <GenieSkeleton className="h-40 w-full rounded-card mb-4" />
          <GenieSkeleton className="h-20 w-full rounded-card" />
        </View>
      </View>
    );
  }

  const loadError = statusQuery.error || plansQuery.error;
  const plan = plansQuery.data?.find(item => item.id === planId);
  if (loadError || !statusQuery.data || !plan) {
    return (
      <View className="flex-1 bg-background">
        {header}
        <GenieErrorState
          title={t('payments:checkout.unavailable')}
          message={loadError ? toAppError(loadError).message : t('payments:checkout.planGone')}
          onRetry={() => {
            statusQuery.refetch();
            plansQuery.refetch();
          }}
        />
      </View>
    );
  }

  const status = statusQuery.data;
  const canPay = status.paymentsEnabled && clientPaymentGateway.isAvailable;
  // Free period: FREE. Payments on but no in-app gateway yet: COMING_SOON.
  const idleState: PaymentState = !status.paymentsEnabled
    ? 'FREE'
    : canPay
    ? 'CHECKOUT'
    : 'COMING_SOON';
  const shownState = flowState ?? idleState;

  const pay = async () => {
    setFlowState('PROCESSING');
    setFlowMessage(undefined);
    try {
      const intent = await paymentService.createPaymentIntent({ purpose: 'subscription', planId });
      const gatewayResult = await clientPaymentGateway.open(intent);
      const verified = await paymentService.verifyPayment({
        paymentId: intent.paymentId,
        ...gatewayResult,
      });
      setFlowState(verified.state);
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (error) {
      setFlowState('FAILED');
      setFlowMessage(toAppError(error).message);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView className="flex-1 px-4" contentContainerClassName="pt-2 pb-10">
        <GenieCard className="mb-4">
          <GenieText variant="caption" tone="muted">
            {t('payments:checkout.selectedPlan')}
          </GenieText>
          <GenieText variant="sectionTitle" className="mt-1">
            {plan.name}
          </GenieText>
          <GenieText variant="body" tone="gold" className="mt-1 font-semibold">
            {t('payments:checkout.pricePer', {
              price: formatAmount(plan.amountMinor, plan.currency),
              interval: displayLabel('payments:interval', plan.interval),
            })}
          </GenieText>
          <View className="mt-3 gap-1.5">
            {plan.features.map(feature => (
              <GenieText key={feature} variant="caption" tone="secondary">
                {`•  ${feature}`}
              </GenieText>
            ))}
          </View>
        </GenieCard>

        <PaymentStateNotice
          state={shownState}
          message={flowMessage ?? (shownState === 'FREE' ? status.message : undefined)}
        />

        <View className="mt-6">
          {canPay && (flowState === null || flowState === 'FAILED') ? (
            <GenieButton label={t('payments:checkout.pay', { amount: formatAmount(plan.amountMinor, plan.currency) })} onPress={pay} />
          ) : (
            <GenieButton
              label={t('payments:checkout.back')}
              variant="secondary"
              onPress={() => navigation.goBack()}
              disabled={flowState === 'PROCESSING'}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};
