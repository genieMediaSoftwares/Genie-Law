const Referral = require("../../models/Referral");
const ApiResponse = require("../../config/ApiResponse");

class ReferralController {
  async myReferrals(req, res, next) {
    try {
      const referrals = await Referral.find({ referrer: req.user._id }).sort({ createdAt: -1 });
      return ApiResponse.success(res, "Referrals fetched.", referrals);
    } catch (error) {
      next(error);
    }
  }

  async myStats(req, res, next) {
    try {
      const referrals = await Referral.find({ referrer: req.user._id });
      const total = referrals.length;
      const signedUp = referrals.filter((r) => r.status !== "invited").length;
      const converted = referrals.filter((r) => r.status === "converted" || r.status === "rewarded").length;
      const totalRewards = referrals.reduce((sum, r) => sum + (r.reward || 0), 0);
      return ApiResponse.success(res, "Referral stats fetched.", {
        total, signedUp, converted, totalRewards,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { refereeEmail, refereePhone, refereeName, refereeRole } = req.body;
      if (!refereeEmail && !refereePhone) {
        return ApiResponse.error(res, "Either referee email or phone is required.", 400);
      }
      const existing = await Referral.findOne({
        referrer: req.user._id,
        $or: [
          refereeEmail ? { refereeEmail } : { refereePhone },
        ],
      });
      if (existing) {
        return ApiResponse.error(res, "This person has already been referred.", 409);
      }
      const referralCode = `${req.user.fullName?.split(" ")[0]?.toUpperCase() || "GENIE"}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const referral = await Referral.create({
        referrer: req.user._id,
        referrerRole: req.user.role,
        refereeEmail: refereeEmail || "",
        refereePhone: refereePhone || "",
        refereeName: refereeName || "",
        refereeRole: refereeRole || "client",
        referralCode,
        status: "invited",
      });
      return ApiResponse.success(res, "Referral created.", referral, 201);
    } catch (error) {
      next(error);
    }
  }

  async listAll(req, res, next) {
    try {
      const referrals = await Referral.find().populate("referrer", "fullName email").sort({ createdAt: -1 });
      return ApiResponse.success(res, "All referrals fetched.", referrals);
    } catch (error) {
      next(error);
    }
  }

  async accept(req, res, next) {
    try {
      const { referralCode } = req.params;
      const referral = await Referral.findOne({ referralCode });
      if (!referral) {
        return ApiResponse.error(res, "Invalid referral code.", 404);
      }
      referral.status = "converted";
      referral.convertedAt = new Date();
      await referral.save();
      return ApiResponse.success(res, "Referral accepted.", referral);
    } catch (error) {
      next(error);
    }
  }

  async stats(req, res, next) {
    try {
      const totalReferrals = await Referral.countDocuments();
      const byStatus = await Referral.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      const byRole = await Referral.aggregate([
        { $group: { _id: "$referrerRole", count: { $sum: 1 } } },
      ]);
      return ApiResponse.success(res, "Referral stats fetched.", {
        total: totalReferrals,
        byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])),
        byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReferralController();
