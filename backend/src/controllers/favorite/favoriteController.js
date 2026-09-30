const Favorite = require("../../models/Favorite");
const Lawyer = require("../../models/Lawyer");
const ApiResponse = require("../../config/ApiResponse");

class FavoriteController {
  async toggleFavorite(req, res, next) {
    try {
      const { lawyerId } = req.body;
      const clientId = req.user._id;

      if (!lawyerId) {
        return ApiResponse.error(res, "lawyerId is required.", 400);
      }

      const existing = await Favorite.findOne({ client: clientId, lawyer: lawyerId });

      if (existing) {
        await Favorite.findByIdAndDelete(existing._id);
        return ApiResponse.success(res, "Lawyer removed from favorites.", { isFavorite: false });
      } else {
        const favorite = await Favorite.create({ client: clientId, lawyer: lawyerId });
        return ApiResponse.success(res, "Lawyer added to favorites.", { isFavorite: true, favorite }, 201);
      }
    } catch (error) {
      next(error);
    }
  }

  async getFavorites(req, res, next) {
    try {
      const clientId = req.user._id;
      const favorites = await Favorite.find({ client: clientId })
        .populate({
          path: "lawyer",
          select: "fullName email mobile profileImage",
        });

      const lawyerIds = favorites.map((f) => f.lawyer?._id).filter(Boolean);
      const profiles = await Lawyer.find({ user: { $in: lawyerIds } });

      const results = favorites.map((fav) => {
        const profile = profiles.find((p) => p.user.toString() === fav.lawyer?._id?.toString());
        return {
          _id: fav._id,
          lawyer: fav.lawyer,
          profile: profile || null,
        };
      });

      return ApiResponse.success(res, "Favorite lawyers fetched.", results);
    } catch (error) {
      next(error);
    }
  }

  async removeFavorite(req, res, next) {
    try {
      const { id } = req.params;
      const favorite = await Favorite.findById(id);

      if (!favorite) {
        return ApiResponse.error(res, "Favorite entry not found.", 404);
      }

      if (favorite.client.toString() !== req.user._id.toString()) {
        return ApiResponse.error(res, "Unauthorized.", 403);
      }

      await Favorite.findByIdAndDelete(id);
      return ApiResponse.success(res, "Removed from favorites.", null);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FavoriteController();
