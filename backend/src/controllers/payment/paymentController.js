const Payment = require("../../models/Payment");
const Transaction = require("../../models/Transaction");
const ApiResponse = require("../../config/ApiResponse");
const paymentService = require("../../services/payment/paymentService");

// Payment-layer errors (e.g. PAYMENTS_DISABLED) become their own responses.
const paymentFailure = (res, error, next) => {
  if (error instanceof paymentService.PaymentError) {
    return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
  }
  return next(error);
};

class PaymentController {
  // GET /payments/status — free period or live payments.
  async getStatus(req, res, next) {
    try {
      return ApiResponse.success(res, "Payment status fetched.", paymentService.getStatus());
    } catch (error) {
      next(error);
    }
  }

  // GET /payments/plans — the plan catalog with its current state.
  async getPlans(req, res, next) {
    try {
      return ApiResponse.success(res, "Plans fetched.", paymentService.getPlans());
    } catch (error) {
      next(error);
    }
  }

  // GET /payments — the signed-in user's real payment history.
  async getHistory(req, res, next) {
    try {
      return ApiResponse.success(res, "Payments fetched.", await paymentService.getHistory(req.user));
    } catch (error) {
      paymentFailure(res, error, next);
    }
  }

  // GET /payments/:id — one payment (owner or admin).
  async getPayment(req, res, next) {
    try {
      return ApiResponse.success(res, "Payment fetched.", await paymentService.getPayment(req.user, req.params.id));
    } catch (error) {
      paymentFailure(res, error, next);
    }
  }

  // POST /payments/intent { purpose, planId } — starts a gateway payment.
  async createPaymentIntent(req, res, next) {
    try {
      const intent = await paymentService.createPaymentIntent(req.user, req.body || {});
      return ApiResponse.success(res, "Payment started.", intent, 201);
    } catch (error) {
      paymentFailure(res, error, next);
    }
  }

  // Kept for existing clients; both start a payment through the service and
  // never record a payment on their own.
  async createConsultationOrder(req, res, next) {
    return this.createPaymentIntent(req, res, next);
  }

  async checkout(req, res, next) {
    return this.createPaymentIntent(req, res, next);
  }

  // POST /payments/verify — the backend confirms with the gateway.
  async verifyPayment(req, res, next) {
    try {
      const result = await paymentService.verifyPayment(req.user, req.body || {});
      return ApiResponse.success(res, "Payment verified.", result);
    } catch (error) {
      paymentFailure(res, error, next);
    }
  }

  // POST /payments/webhook — gateway notifications, verified and applied now.
  async handleWebhook(req, res, next) {
    try {
      const result = await paymentService.handleWebhook(req);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      paymentFailure(res, error, next);
    }
  }

  async getEarnings(req, res, next) {
    try {
      const userId = req.user._id;
      const transactions = await Transaction.find({ user: userId });

      let totalEarnings = 0;
      let totalWithdrawals = 0;
      let pendingWithdrawals = 0;
      let creditCount = 0;

      for (const tx of transactions) {
        if (tx.type === "credit" && tx.status === "completed") {
          totalEarnings += tx.amount || 0;
          creditCount += 1;
        } else if (tx.type === "withdrawal") {
          if (tx.status === "completed") {
            totalWithdrawals += tx.amount || 0;
          } else if (tx.status === "pending") {
            pendingWithdrawals += tx.amount || 0;
          }
        }
      }

      const walletBalance = Math.max(0, totalEarnings - (totalWithdrawals + pendingWithdrawals));

      const summary = {
        totalEarnings,
        totalWithdrawals,
        pendingWithdrawals,
        walletBalance,
        creditCount,
      };

      return ApiResponse.success(res, "Earnings summary fetched.", summary);
    } catch (error) {
      next(error);
    }
  }

  async requestWithdrawal(req, res, next) {
    try {
      const { amount } = req.body;
      const userId = req.user._id;

      if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return ApiResponse.error(res, "Invalid withdrawal amount.", 400);
      }

      const transactions = await Transaction.find({ user: userId });

      let totalEarnings = 0;
      let totalWithdrawals = 0;
      let pendingWithdrawals = 0;

      for (const tx of transactions) {
        if (tx.type === "credit" && tx.status === "completed") {
          totalEarnings += tx.amount || 0;
        } else if (tx.type === "withdrawal") {
          if (tx.status === "completed") {
            totalWithdrawals += tx.amount || 0;
          } else if (tx.status === "pending") {
            pendingWithdrawals += tx.amount || 0;
          }
        }
      }

      const walletBalance = Math.max(0, totalEarnings - (totalWithdrawals + pendingWithdrawals));

      if (Number(amount) > walletBalance) {
        return ApiResponse.error(res, "Insufficient wallet balance.", 400);
      }

      const withdrawalTx = await Transaction.create({
        user: userId,
        amount: Number(amount),
        type: "withdrawal",
        description: "Withdrawal request",
        status: "pending",
      });

      return ApiResponse.success(res, "Withdrawal requested.", withdrawalTx, 201);
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req, res, next) {
    try {
      const userId = req.user._id;
      const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });
      return ApiResponse.success(res, "Transactions fetched.", transactions);
    } catch (error) {
      next(error);
    }
  }

}

const controller = new PaymentController();
// Routes pass methods unbound; bind so methods can call each other.
for (const name of Object.getOwnPropertyNames(PaymentController.prototype)) {
  if (name !== "constructor") controller[name] = controller[name].bind(controller);
}
module.exports = controller;
