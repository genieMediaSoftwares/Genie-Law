// Picks the payment gateway adapter from PAYMENT_GATEWAY (backend/.env).
//
// Each adapter implements: id, isLive, createOrder, verifyPayment,
// parseWebhook, refund. Adding a provider later means adding one adapter here
// (e.g. RazorpayPaymentGateway) with its secrets as Render environment variables — screens,
// controllers and the payment service do not change.

const DisabledPaymentGateway = require("./DisabledPaymentGateway");

const ADAPTERS = {
  disabled: () => new DisabledPaymentGateway(),
};

function createGateway(gatewayId) {
  const factory = ADAPTERS[gatewayId];
  if (!factory) {
    throw new Error(
      `PAYMENT_GATEWAY "${gatewayId}" has no adapter. Available: ${Object.keys(ADAPTERS).join(", ")}.`
    );
  }
  return factory();
}

module.exports = { createGateway };
