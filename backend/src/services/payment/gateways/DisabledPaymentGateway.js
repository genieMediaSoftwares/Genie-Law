// The gateway used while payments are off (the free period).
//
// It never talks to a payment provider and never reports a payment as made:
// every money-moving operation is refused with PAYMENTS_DISABLED, so no order,
// transaction or refund can be recorded as if it happened.

const { PaymentsDisabledError } = require("../paymentErrors");

class DisabledPaymentGateway {
  get id() {
    return "disabled";
  }

  get isLive() {
    return false;
  }

  async createOrder() {
    throw new PaymentsDisabledError();
  }

  async verifyPayment() {
    throw new PaymentsDisabledError();
  }

  async parseWebhook() {
    throw new PaymentsDisabledError();
  }

  async refund() {
    throw new PaymentsDisabledError();
  }
}

module.exports = DisabledPaymentGateway;
