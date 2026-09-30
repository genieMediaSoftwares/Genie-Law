const Subscription = require("../../models/Subscription");
const Lawyer = require("../../models/Lawyer");
const paymentService = require("../../services/payment/paymentService");
const ApiResponse = require("../../config/ApiResponse");

class SubscriptionController {
  async getSubscription(req, res, next) {
    try {
      const userId = req.user._id;
      let subscription = await Subscription.findOne({ user: userId, status: "active" }).sort({ endDate: -1 });

      // No paid subscription: the lawyer is on the free tier (no dates, since
      // nothing was bought).
      if (!subscription) {
        return ApiResponse.success(res, "No paid subscription.", {
          plan: "Free",
          status: "free",
          paymentState: paymentService.getStatus().state,
          startDate: null,
          endDate: null,
        });
      }

      return ApiResponse.success(res, "Active subscription retrieved.", subscription);
    } catch (error) {
      next(error);
    }
  }

  // Buying a plan starts a payment; the subscription is only activated once the
  // backend has verified that payment with the gateway.
  async createSubscriptionOrder(req, res, next) {
    try {
      const isLawyer = req.user.role === "lawyer" || (await Lawyer.exists({ user: req.user._id }));
      if (!isLawyer) {
        return ApiResponse.error(res, "Only registered lawyers can purchase subscription plans.", 403);
      }
      const intent = await paymentService.createPaymentIntent(req.user, {
        purpose: "subscription",
        planId: req.body && req.body.plan,
      });
      return ApiResponse.success(res, "Payment started.", intent, 201);
    } catch (error) {
      if (error instanceof paymentService.PaymentError) {
        return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
      }
      next(error);
    }
  }

  async subscribe(req, res, next) {
    return this.createSubscriptionOrder(req, res, next);
  }

  async cancelSubscription(req, res, next) {
    try {
      const userId = req.user._id;
      const subscription = await Subscription.findOneAndUpdate(
        { user: userId, status: "active" },
        { status: "cancelled" },
        { new: true }
      );

      if (!subscription) {
        return ApiResponse.error(res, "No active subscription found to cancel.", 404);
      }

      await Lawyer.findOneAndUpdate({ user: userId }, { subscriptionPlan: "Free" });

      return ApiResponse.success(res, "Subscription cancelled successfully.", subscription);
    } catch (error) {
      next(error);
    }
  }
}

const controller = new SubscriptionController();
for (const name of Object.getOwnPropertyNames(SubscriptionController.prototype)) {
  if (name !== "constructor") controller[name] = controller[name].bind(controller);
}
module.exports = controller;
