const Promotion = require("../../models/Promotion");
const ApiResponse = require("../../config/ApiResponse");

class PromotionController {
  async list(req, res, next) {
    try {
      const { isActive } = req.query;
      const query = {};
      if (isActive !== undefined) {
        query.isActive = isActive === "true" || isActive === true;
      }
      const promotions = await Promotion.find(query).sort({ createdAt: -1 });
      return ApiResponse.success(res, "Promotions fetched.", promotions);
    } catch (error) {
      next(error);
    }
  }

  async validateCode(req, res, next) {
    try {
      const { code, plan, amount } = req.body;
      if (!code) {
        return ApiResponse.error(res, "Promo code is required.", 400);
      }
      const promotion = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
      if (!promotion) {
        return ApiResponse.error(res, "Invalid or expired promo code.", 404);
      }
      const now = new Date();
      if (now < promotion.startDate || now > promotion.endDate) {
        return ApiResponse.error(res, "This promo code is not active.", 400);
      }
      if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
        return ApiResponse.error(res, "This promo code has been fully used.", 400);
      }
      if (promotion.minAmount && amount && amount < promotion.minAmount) {
        return ApiResponse.error(res, `Minimum purchase of ₹${promotion.minAmount} required.`, 400);
      }
      let discount = 0;
      if (promotion.discountType === "percentage") {
        discount = ((amount || 0) * promotion.discountValue) / 100;
        if (promotion.maxDiscount && discount > promotion.maxDiscount) {
          discount = promotion.maxDiscount;
        }
      } else {
        discount = promotion.discountValue;
      }
      return ApiResponse.success(res, "Promo code applied.", {
        code: promotion.code,
        name: promotion.name,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        calculatedDiscount: discount,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const {
        name, description, code, discountType, discountValue, applicableTo,
        eligibleCategory, eligiblePlan, startDate, endDate, maxUses, maxUsesPerUser, minAmount,
      } = req.body;
      if (!name || !code || !discountType || !discountValue || !startDate || !endDate) {
        return ApiResponse.error(res, "Required fields: name, code, discountType, discountValue, startDate, endDate.", 400);
      }
      const existing = await Promotion.findOne({ code: code.toUpperCase() });
      if (existing) {
        return ApiResponse.error(res, "A promotion with this code already exists.", 409);
      }
      const promotion = await Promotion.create({
        name, description, code: code.toUpperCase(), discountType, discountValue,
        applicableTo: applicableTo || "consultation", eligibleCategory, eligiblePlan,
        startDate, endDate, maxUses: maxUses || 0, maxUsesPerUser: maxUsesPerUser || 1,
        minAmount: minAmount || 0, createdBy: req.user._id,
      });
      return ApiResponse.success(res, "Promotion created successfully.", promotion, 201);
    } catch (error) {
      next(error);
    }
  }

  async toggle(req, res, next) {
    try {
      const { id } = req.params;
      const promotion = await Promotion.findById(id);
      if (!promotion) {
        return ApiResponse.error(res, "Promotion not found.", 404);
      }
      promotion.isActive = !promotion.isActive;
      await promotion.save();
      return ApiResponse.success(res, "Promotion toggled successfully.", promotion);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const promotion = await Promotion.findById(id);
      if (!promotion) {
        return ApiResponse.error(res, "Promotion not found.", 404);
      }
      return ApiResponse.success(res, "Promotion fetched.", promotion);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const promotion = await Promotion.findByIdAndUpdate(id, { $set: updates }, { new: true });
      if (!promotion) {
        return ApiResponse.error(res, "Promotion not found.", 404);
      }
      return ApiResponse.success(res, "Promotion updated.", promotion);
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      await Promotion.findByIdAndDelete(id);
      return ApiResponse.success(res, "Promotion deleted.");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PromotionController();
