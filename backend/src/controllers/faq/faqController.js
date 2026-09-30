const FAQ = require("../../models/FAQ");
const ApiResponse = require("../../config/ApiResponse");

class FAQController {
  async getFAQs(req, res, next) {
    try {
      const { category, search } = req.query;
      let query = {};

      if (category && category !== "All") {
        query.category = { $regex: category, $options: "i" };
      }

      if (search) {
        query.$or = [
          { question: { $regex: search, $options: "i" } },
          { answer: { $regex: search, $options: "i" } }
        ];
      }

      const faqs = await FAQ.find(query).sort({ category: 1 });
      return ApiResponse.success(res, "FAQs fetched successfully.", faqs);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FAQController();
