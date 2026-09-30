const express = require("express");
const reviewController = require("../controllers/review/reviewController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", reviewController.createReview);
router.get("/", reviewController.getReviews);
router.put("/:id/reply", reviewController.replyToReview);
// Moderation: hiding a review is an admin action. Without this any signed-in
// user could hide any review by id.
router.put("/:id/hide", roleMiddleware("admin"), reviewController.hideReview);
router.post("/:id/report", reviewController.reportReview);

module.exports = router;
