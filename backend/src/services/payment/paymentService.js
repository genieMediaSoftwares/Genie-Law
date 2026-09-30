// Payment business logic. Controllers call this; it calls the gateway adapter.
//
// Configuration (backend/.env, Render environment variables in production):
//   PAYMENTS_ENABLED  "true" | "false" — false = free period, no payments
//   PAYMENT_GATEWAY   adapter id (services/payment/gateways); "disabled" now
//
// Rules:
//   - During the free period every money-moving call is refused
//     (PAYMENTS_DISABLED); no payment, transaction or refund is recorded.
//   - A payment only becomes SUCCESS when the backend verifies it with the
//     gateway (verifyPayment / webhook), never on the client's word.

const Payment = require("../../models/Payment");
const { required } = require("../../config/env");
const { PLANS, findPlan } = require("./paymentPlans");
const { PAYMENT_STATES, toPaymentState } = require("./paymentStates");
const { createGateway } = require("./gateways");
const { PaymentError, PaymentsDisabledError } = require("./paymentErrors");

const readEnabled = () => {
  const value = required("PAYMENTS_ENABLED").toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new Error('PAYMENTS_ENABLED must be "true" or "false".');
  }
  return value === "true";
};

const paymentsEnabled = () => readEnabled();

const gateway = () => {
  const adapter = createGateway(required("PAYMENT_GATEWAY"));
  if (paymentsEnabled() && !adapter.isLive) {
    throw new Error("PAYMENTS_ENABLED is true but PAYMENT_GATEWAY is not a live gateway.");
  }
  return adapter;
};

const assertEnabled = () => {
  if (!paymentsEnabled()) throw new PaymentsDisabledError();
};

// What the apps show: free period vs. live payments.
function getStatus() {
  const enabled = paymentsEnabled();
  const adapter = gateway();
  return {
    paymentsEnabled: enabled,
    state: enabled ? PAYMENT_STATES.PAYMENT_REQUIRED : PAYMENT_STATES.FREE,
    mode: enabled ? "LIVE" : "FREE_PERIOD",
    gateway: adapter.id,
    gatewayLive: adapter.isLive,
    message: enabled
      ? "Payments are enabled."
      : "Genie Law is currently free. Payment features will be available soon.",
  };
}

function getPlans() {
  const enabled = paymentsEnabled();
  return PLANS.map((plan) => ({
    ...plan,
    state: enabled ? PAYMENT_STATES.PAYMENT_REQUIRED : PAYMENT_STATES.COMING_SOON,
  }));
}

const toView = (payment) => {
  const view = typeof payment.toJSON === "function" ? payment.toJSON() : payment;
  return { ...view, state: toPaymentState(view.status) };
};

// Payments the user actually made or received. Real rows only.
async function getHistory(user) {
  const filter = user.role === "lawyer" ? { lawyer: user._id } : { client: user._id };
  const payments = await Payment.find(filter)
    .populate("lawyer", "fullName email")
    .populate("client", "fullName email")
    .sort({ createdAt: -1 });
  return payments.map(toView);
}

async function getPayment(user, paymentId) {
  const payment = await Payment.findById(paymentId)
    .populate("lawyer", "fullName email")
    .populate("client", "fullName email");
  if (!payment) throw new PaymentError("Payment not found.", 404, "PAYMENT_NOT_FOUND");

  const uid = user._id.toString();
  const owner =
    user.role === "admin" ||
    (payment.client && (payment.client._id || payment.client).toString() === uid) ||
    (payment.lawyer && (payment.lawyer._id || payment.lawyer).toString() === uid);
  if (!owner) throw new PaymentError("Payment not found.", 404, "PAYMENT_NOT_FOUND");
  return toView(payment);
}

// Starts a payment with the gateway. Refused during the free period.
async function createPaymentIntent(user, { purpose, planId }) {
  assertEnabled();
  if (purpose !== "subscription") {
    throw new PaymentError("Unsupported payment purpose.", 400, "INVALID_PURPOSE");
  }
  const plan = findPlan(planId);
  if (!plan) throw new PaymentError("Unknown plan.", 400, "INVALID_PLAN");
  return gateway().createOrder({ user, plan });
}

// Confirms a payment with the gateway (never trusts the client alone).
async function verifyPayment(user, details) {
  assertEnabled();
  return gateway().verifyPayment({ user, details });
}

// Gateway -> backend notification. Verified by the adapter.
async function handleWebhook(request) {
  assertEnabled();
  return gateway().parseWebhook(request);
}

async function requestRefund(actor, paymentId, reason) {
  assertEnabled();
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new PaymentError("Payment not found.", 404, "PAYMENT_NOT_FOUND");
  return gateway().refund({ actor, payment, reason });
}

module.exports = {
  PAYMENT_STATES,
  paymentsEnabled,
  getStatus,
  getPlans,
  getHistory,
  getPayment,
  createPaymentIntent,
  verifyPayment,
  handleWebhook,
  requestRefund,
  PaymentError,
};
