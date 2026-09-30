const express = require("express");
const paymentController = require("../controllers/payment/paymentController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/webhook", paymentController.handleWebhook);

router.use(authMiddleware);

router.get("/", paymentController.getHistory);
router.get("/status", paymentController.getStatus);
router.get("/plans", paymentController.getPlans);
router.post("/intent", paymentController.createPaymentIntent);
router.post("/create-consultation-order", paymentController.createConsultationOrder);
router.post("/verify", paymentController.verifyPayment);

router.get("/earnings", paymentController.getEarnings);
router.post("/withdraw", paymentController.requestWithdrawal);
router.get("/transactions", paymentController.getTransactions);
router.post("/checkout", paymentController.checkout);

// Last: "/:id" would otherwise match the named routes above.
router.get("/:id", paymentController.getPayment);

module.exports = router;
