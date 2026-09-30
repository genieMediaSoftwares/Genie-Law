// Payment types shared by the payment service, screens and components.
// The backend is the only authority for every value here.

export type PaymentState =
  | 'FREE'
  | 'PAYMENT_REQUIRED'
  | 'CHECKOUT'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'EXPIRED'
  | 'COMING_SOON';

// GET /payments/status — free period or live payments.
export interface PaymentPlatformStatus {
  paymentsEnabled: boolean;
  state: PaymentState;
  mode: 'FREE_PERIOD' | 'LIVE';
  gateway: string;
  gatewayLive: boolean;
  message: string;
}

// GET /payments/plans — amounts in paise (INR minor units).
export interface PaymentPlan {
  id: string;
  name: string;
  amountMinor: number;
  currency: string;
  interval: 'month' | 'year';
  popular?: boolean;
  features: string[];
  state: PaymentState;
}

// POST /payments/intent — what a gateway needs to open its checkout.
export interface PaymentIntent {
  paymentId: string;
  gateway: string;
  checkout: Record<string, unknown>;
}

export const formatAmount = (amountMinor: number, currency: string): string =>
  `${currency === 'INR' ? '₹' : `${currency} `}${(amountMinor / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
