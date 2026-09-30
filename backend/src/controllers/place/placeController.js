const ApiResponse = require("../../config/ApiResponse");
const placesService = require("../../services/placesService");

class PlaceController {
  async autocomplete(req, res, next) {
    try {
      const { input, country } = req.query;

      if (!input || input.trim().length === 0) {
        return ApiResponse.success(res, "Suggestions fetched.", []);
      }

      const suggestions = await placesService.autocomplete(input, {
        country: (country || "in").toLowerCase(),
      });

      return ApiResponse.success(res, "Suggestions fetched.", suggestions);
    } catch (error) {
      next(error);
    }
  }

  async details(req, res, next) {
    try {
      const { placeId } = req.query;

      if (!placeId || placeId.trim().length === 0) {
        return ApiResponse.error(res, "Place ID is required.", 400);
      }

      const details = await placesService.details(placeId.trim());
      return ApiResponse.success(res, "Place details fetched.", details);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PlaceController();
