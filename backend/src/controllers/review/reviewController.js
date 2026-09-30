const Review = require("../../models/Review");
const notificationService = require("../../services/notification/notificationService");
const Case = require("../../models/Case");
const Appointment = require("../../models/Appointment");
const ApiResponse = require("../../config/ApiResponse");
const User = require("../../models/User");
const AuditLog = require("../../models/AuditLog");
const { recalculateLawyerRating } = require("../../services/review/ratingService");

class ReviewController {
  async createReview(req, res, next) {
    try {
      const { lawyerId, rating, review } = req.body;
      const client = req.user._id;

      // Ratings come from clients only: lawyers cannot rate (themselves or a
      // colleague) and admins moderate rather than rate.
      if (req.user.role !== "client") {
        return ApiResponse.error(res, "Only clients can rate an advocate.", 403);
      }

      if (!lawyerId || !rating || !review) {
        return ApiResponse.error(res, "Lawyer ID, rating, and review text are required.", 400);
      }

      const ratingValue = Number(rating);
      if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return ApiResponse.error(res, "Rating must be a whole number from 1 to 5 stars.", 400);
      }

      if (String(lawyerId) === String(client)) {
        return ApiResponse.error(res, "You cannot rate yourself.", 403);
      }

      if (!(await User.exists({ _id: lawyerId, role: "lawyer" }))) {
        return ApiResponse.error(res, "Advocate not found.", 404);
      }

      // Only a client who actually worked with this lawyer may review them:
      // a case assigned to them, or a booked appointment. Without this any
      // signed-in user could review any lawyer and move their rating.
      const [workedTogether, hadAppointment] = await Promise.all([
        Case.exists({ client, assignedLawyer: lawyerId }),
        Appointment.exists({ client, lawyer: lawyerId }),
      ]);

      if (!workedTogether && !hadAppointment) {
        return ApiResponse.error(
          res,
          "You can review an advocate only after a consultation or case with them.",
          403
        );
      }

      // One review per advocate per client, so a rating cannot be stacked.
      const existing = await Review.findOne({ lawyer: lawyerId, client });
      if (existing) {
        return ApiResponse.error(
          res,
          "You have already reviewed this advocate.",
          409
        );
      }

      let newReview;
      try {
        newReview = await Review.create({
          lawyer: lawyerId,
          client,
          rating: ratingValue,
          review,
        });
      } catch (error) {
        // The unique (lawyer, client) index: a concurrent duplicate lost the race.
        if (error && error.code === 11000) {
          return ApiResponse.error(res, "You have already reviewed this advocate.", 409);
        }
        throw error;
      }

      // Stores the new aggregate in MongoDB and broadcasts lawyer_rating_updated.
      const aggregate = await recalculateLawyerRating(lawyerId);

      await notificationService.createAndSendNotification({
        senderId: client,
        receiverId: lawyerId,
        type: "review_received",
        title: "New Review Received",
        message: `A client left you a ${rating}-star review: "${review.substring(0, 30)}${review.length > 30 ? '...' : ''}"`,
        referenceId: newReview._id.toString()
      });

      return ApiResponse.success(
        res,
        "Review submitted successfully.",
        { ...newReview.toJSON(), lawyerRating: aggregate },
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getReviews(req, res, next) {
    try {
      const { lawyerId } = req.query;
      let query = { isHidden: false };

      if (lawyerId) {
        query.lawyer = lawyerId;
      } else if (req.user.role === "lawyer") {
        query.lawyer = req.user._id;
      } else {
        // A client asking without a lawyerId gets their own reviews, not every
        // review on the platform (which exposed other clients' names and text).
        query.client = req.user._id;
      }

      const reviews = await Review.find(query)
        .populate("client", "fullName profileImage")
        .sort({ createdAt: -1 });

      return ApiResponse.success(res, "Reviews fetched successfully.", reviews);
    } catch (error) {
      next(error);
    }
  }

  async replyToReview(req, res, next) {
    try {
      const { id } = req.params;
      const { reply } = req.body;
      const lawyerId = req.user._id;

      const reviewItem = await Review.findById(id);
      if (!reviewItem) {
        return ApiResponse.error(res, "Review not found.", 404);
      }

      if (reviewItem.lawyer.toString() !== lawyerId.toString()) {
        return ApiResponse.error(res, "Unauthorized to reply to this review.", 403);
      }

      reviewItem.reply = reply;
      reviewItem.replyDate = new Date();
      await reviewItem.save();

      await notificationService.createAndSendNotification({
        senderId: lawyerId,
        receiverId: reviewItem.client,
        type: "review_received",
        title: "Advocate Replied to Your Review",
        message: `An advocate replied to your review: "${reply.substring(0, 30)}${reply.length > 30 ? '...' : ''}"`,
        referenceId: reviewItem._id.toString()
      });

      return ApiResponse.success(res, "Reply added successfully.", reviewItem);
    } catch (error) {
      next(error);
    }
  }

  async hideReview(req, res, next) {
    try {
      const { id } = req.params;

      const reviewItem = await Review.findById(id);
      if (!reviewItem) {
        return ApiResponse.error(res, "Review not found.", 404);
      }

      reviewItem.isHidden = true;
      await reviewItem.save();

      await AuditLog.create({
        performedBy: req.user._id,
        action: "hide_review",
        targetModel: "Review",
        targetId: reviewItem._id.toString(),
        details: { lawyer: reviewItem.lawyer.toString(), rating: reviewItem.rating },
        ipAddress: req.ip || "",
        userAgent: req.get("User-Agent") || "",
      });

      await recalculateLawyerRating(reviewItem.lawyer);

      return ApiResponse.success(res, "Review hidden successfully.", reviewItem);
    } catch (error) {
      next(error);
    }
  }

  async reportReview(req, res, next) {
    try {
      const { id } = req.params;

      const reviewItem = await Review.findById(id);
      if (!reviewItem) {
        return ApiResponse.error(res, "Review not found.", 404);
      }

      reviewItem.isReported = true;
      await reviewItem.save();

      return ApiResponse.success(res, "Review reported successfully.", reviewItem);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();
