import type { PaymentIntent } from '../types/payments';
import i18n from '../i18n';

// The in-app side of a payment gateway (e.g. opening its checkout sheet).
//
// None is connected during the free period. When a gateway is added, implement
// `open` here with that gateway's SDK and set `isAvailable` to true — the
// screens already route through it. `open` only returns what the gateway hands
// back; the backend verifies it (paymentService.verifyPayment / webhook) and is
// the only authority on whether the payment succeeded.

export interface ClientPaymentGateway {
  isAvailable: boolean;
  open(intent: PaymentIntent): Promise<Record<string, unknown>>;
}

export const clientPaymentGateway: ClientPaymentGateway = {
  isAvailable: false,
  async open() {
    throw new Error(i18n.t('payments:noGateway'));
  },
};
