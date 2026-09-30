// The payment states the API and the apps understand.
//
// FREE and COMING_SOON describe the platform (free period / not launched yet);
// the others describe one payment. Stored payment rows keep their lowercase
// status (payments.status); toPaymentState maps them.

const PAYMENT_STATES = Object.freeze({
  FREE: "FREE",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  CHECKOUT: "CHECKOUT",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  EXPIRED: "EXPIRED",
  COMING_SOON: "COMING_SOON",
});

// payments.status -> state.
const STORED_STATUS_TO_STATE = Object.freeze({
  pending: PAYMENT_STATES.CHECKOUT,
  processing: PAYMENT_STATES.PROCESSING,
  completed: PAYMENT_STATES.SUCCESS,
  failed: PAYMENT_STATES.FAILED,
  cancelled: PAYMENT_STATES.CANCELLED,
  refunded: PAYMENT_STATES.REFUNDED,
  expired: PAYMENT_STATES.EXPIRED,
});

const STORED_PAYMENT_STATUSES = Object.freeze(Object.keys(STORED_STATUS_TO_STATE));

const toPaymentState = (storedStatus) => {
  const state = STORED_STATUS_TO_STATE[storedStatus];
  if (!state) throw new Error(`Unknown stored payment status: ${storedStatus}`);
  return state;
};

module.exports = { PAYMENT_STATES, STORED_PAYMENT_STATUSES, toPaymentState };
