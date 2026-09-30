const Court = require("../../models/Court");
const ApiResponse = require("../../config/ApiResponse");

class CourtController {
  async getCourts(req, res, next) {
    try {
      const { city, district, state } = req.query;
      let query = { isActive: true };

      if (city && state) {
        query.$or = [
          {
            city: new RegExp("^" + city.trim() + "$", "i"),
            state: new RegExp("^" + state.trim() + "$", "i")
          },
          {
            district: new RegExp("^" + city.trim() + "$", "i"),
            state: new RegExp("^" + state.trim() + "$", "i")
          }
        ];
      } else {
        if (city) {
          query.$or = [
            { city: new RegExp("^" + city.trim() + "$", "i") },
            { district: new RegExp("^" + city.trim() + "$", "i") }
          ];
        }
        if (state) {
          query.state = new RegExp("^" + state.trim() + "$", "i");
        }
        if (district) {
          query.district = new RegExp("^" + district.trim() + "$", "i");
        }
      }

      const courts = await Court.find(query).sort({ courtName: 1 });
      return ApiResponse.success(res, "Courts fetched successfully.", courts);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CourtController();
