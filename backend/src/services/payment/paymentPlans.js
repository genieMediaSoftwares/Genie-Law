// The lawyer subscription plan catalog: the one place plans and prices are
// defined. The apps read it from GET /api/payments/plans.
//
// Amounts are in paise (INR minor units), as payment gateways expect.

const PLANS = Object.freeze([
  {
    id: "Starter",
    name: "Starter",
    amountMinor: 99900,
    currency: "INR",
    interval: "month",
    features: ["Chat Support", "Basic Profile Listing"],
  },
  {
    id: "Professional",
    name: "Professional",
    amountMinor: 299900,
    currency: "INR",
    interval: "month",
    features: ["Priority Support", "Featured in Search"],
  },
  {
    id: "Premium",
    name: "Premium",
    amountMinor: 599900,
    currency: "INR",
    interval: "month",
    popular: true,
    features: ["Verified Badge", "Priority Support", "Featured Listing", "Profile Highlight"],
  },
  {
    id: "Elite",
    name: "Elite",
    amountMinor: 1299900,
    currency: "INR",
    interval: "month",
    features: ["Verified Badge", "Top Ranking", "Featured Profile", "Dedicated Manager"],
  },
]);

const findPlan = (planId) => PLANS.find((plan) => plan.id === planId) || null;

module.exports = { PLANS, findPlan };
