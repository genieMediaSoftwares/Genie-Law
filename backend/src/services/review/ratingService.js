// A lawyer's rating aggregate (lawyers.rating / lawyers.total_reviews).
//
// The backend is the only place it is calculated: always from the visible
// reviews stored in the database, never from a value sent by a client. Every change to
// the reviews behind it (new review, hide/unhide, removal) calls
// recalculateLawyerRating, which stores the result and broadcasts it.

const Review = require("../../models/Review");
const Lawyer = require("../../models/Lawyer");
const realtimeEvents = require("../../realtime/events");

const idString = (id) => (id && id._id ? id._id : id).toString();

async function recalculateLawyerRating(lawyerUserId) {
  const lawyerId = idString(lawyerUserId);
  const visible = await Review.find({ lawyer: lawyerId, isHidden: false }).select("rating");

  const totalReviews = visible.length;
  const rating =
    totalReviews > 0
      ? Number((visible.reduce((sum, r) => sum + Number(r.rating), 0) / totalReviews).toFixed(1))
      : 0;

  await Lawyer.findOneAndUpdate({ user: lawyerId }, { rating, totalReviews });

  const aggregate = { lawyerId, rating, totalReviews, updatedAt: new Date().toISOString() };
  realtimeEvents.lawyerRatingUpdated(aggregate);
  return aggregate;
}

module.exports = { recalculateLawyerRating };
