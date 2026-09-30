// Errors the payment layer raises; the controllers turn them into responses.

class PaymentError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

class PaymentsDisabledError extends PaymentError {
  constructor() {
    super(
      "Payments are not enabled yet. Genie Law is currently free — payment features will be available soon.",
      409,
      "PAYMENTS_DISABLED"
    );
  }
}

module.exports = { PaymentError, PaymentsDisabledError };
