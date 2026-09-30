const express = require("express");
const subscriptionController = require("../controllers/subscription/subscriptionController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", subscriptionController.getSubscription);
router.post("/create-order", subscriptionController.createSubscriptionOrder);
router.post("/subscribe", subscriptionController.subscribe);
router.post("/cancel", subscriptionController.cancelSubscription);

module.exports = router;
