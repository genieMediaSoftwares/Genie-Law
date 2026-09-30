const express = require("express");
const router = express.Router();
const referralController = require("../controllers/referral/referralController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/my", referralController.myReferrals);
router.get("/", referralController.listAll);
router.post("/", referralController.create);
router.post("/accept/:referralCode", referralController.accept);
router.get("/stats", referralController.stats);

module.exports = router;
