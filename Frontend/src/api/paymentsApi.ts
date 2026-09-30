import { useQuery } from '@tanstack/react-query';

import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type { PaymentRecord } from '../types/domain';
import type { PaymentIntent, PaymentPlan, PaymentPlatformStatus } from '../types/payments';

// The app's one payment service. Screens call only this; it calls only the
// backend. Whether payments are on (PAYMENTS_ENABLED), which gateway is used
// and whether a payment succeeded are all decided by the backend — never here.
// During the free period the money-moving calls are refused by the backend
// with PAYMENTS_DISABLED, so they are never reached from the UI.

export const paymentService = {
  async getPaymentStatus(): Promise<PaymentPlatformStatus> {
    const response = await apiClient.get<ApiSuccess<PaymentPlatformStatus>>('/payments/status');
    return unwrap(response);
  },

  async getPlans(): Promise<PaymentPlan[]> {
    const response = await apiClient.get<ApiSuccess<PaymentPlan[]>>('/payments/plans');
    return unwrap(response) ?? [];
  },

  async getPaymentHistory(): Promise<PaymentRecord[]> {
    const response = await apiClient.get<ApiSuccess<PaymentRecord[]>>('/payments');
    return unwrap(response) ?? [];
  },

  async getTransaction(paymentId: string): Promise<PaymentRecord> {
    const response = await apiClient.get<ApiSuccess<PaymentRecord>>(
      `/payments/${encodeURIComponent(paymentId)}`,
    );
    return unwrap(response);
  },

  // Future gateway flow: the backend creates the order with the gateway.
  async createPaymentIntent(input: { purpose: 'subscription'; planId: string }): Promise<PaymentIntent> {
    const response = await apiClient.post<ApiSuccess<PaymentIntent>>('/payments/intent', input);
    return unwrap(response);
  },

  // Future gateway flow: the backend verifies with the gateway; the app only
  // passes along what the gateway returned.
  async verifyPayment(details: Record<string, unknown>): Promise<PaymentRecord> {
    const response = await apiClient.post<ApiSuccess<PaymentRecord>>('/payments/verify', details);
    return unwrap(response);
  },
};

export const paymentKeys = {
  status: ['payments', 'status'] as const,
  plans: ['payments', 'plans'] as const,
  history: ['payments', 'history'] as const,
  detail: (id: string) => ['payments', 'detail', id] as const,
};

export const usePaymentStatus = () =>
  useQuery({ queryKey: paymentKeys.status, queryFn: paymentService.getPaymentStatus });
