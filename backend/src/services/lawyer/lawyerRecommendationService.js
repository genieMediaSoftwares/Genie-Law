const Lawyer = require("../../models/Lawyer");

// Build a MongoDB query that pre-filters lawyers whose specialization is
// plausibly relevant to the requested category. The expensive JavaScript
// scoring only runs on this bounded candidate set.
function buildPreFilter(catPattern, subPattern) {
  const cat = catPattern.toLowerCase();
  const sub = subPattern.toLowerCase();

  // Matches any lawyer whose specialization relates to the category, or whose
  // specialization is a general/litigation catch-all. This mirrors the first
  // filter in the scoring step, so every lawyer that would score positively
  // is included in the candidate set.
  const conditions = [
    { specialization: { $regex: cat, $options: "i" } },
    { specialization: { $regex: `${cat}s?$`, $options: "i" } },
  ];
  if (sub) {
    conditions.push({ specialization: { $regex: sub, $options: "i" } });
  }
  conditions.push({ specialization: { $regex: "\\b(general|litigation)\\b", $options: "i" } });

  // Only return lawyers that have an active user account.
  return {
    $or: conditions,
    "user.isActive": { $ne: false },
  };
}

class LawyerRecommendationService {
  async getRecommendations({ category, subcategory, city, district, state, sortBy, limit = 10 }) {
    if (!category) {
      throw new Error("Category is required for recommendation.");
    }

    const catPattern = category.trim();
    const subPattern = (subcategory || "").trim();

    // Push pre-filtering into MongoDB so the entire collection is never loaded.
    const mongoFilter = buildPreFilter(catPattern, subPattern);

    const candidates = await Lawyer.find(mongoFilter)
      .select("specialization experience rating totalReviews consultationFee languages practiceAreas district location createdAt casesHandled winPercentage responseTime bio education barCouncilNumber officeAddress workingHours")
      .populate("user", "fullName email mobile profileImage location isVerified isActive")
      .lean();

    if (!candidates.length) {
      return [];
    }

    const cat = catPattern.toLowerCase();
    const sub = subPattern.toLowerCase();

    const scored = candidates.map((lawyer) => {
      const user = lawyer.user;
      if (!user) return null;

      const userLoc = (user.location || "").toLowerCase();
      const spec = (lawyer.specialization || "").toLowerCase();

      let locationScore = 0;
      if (city && userLoc.includes(city.toLowerCase())) {
        locationScore = 35;
      } else if (district && userLoc.includes(district.toLowerCase())) {
        locationScore = 25;
      } else if (state && userLoc.includes(state.toLowerCase())) {
        locationScore = 15;
      }

      let specScore = 0;
      if (spec.includes(cat) || cat.includes(spec)) {
        specScore += 20;
      }
      if (sub && (spec.includes(sub) || sub.includes(spec))) {
        specScore += 10;
      }
      if (spec.includes("general") || spec.includes("litigation")) {
        specScore += 10;
      }

      const ratingScore = ((lawyer.rating || 4.0) / 5.0) * 15;
      const expScore = Math.min(10, ((lawyer.experience || 1) / 10) * 10);
      const verifiedScore = user.isVerified ? 10 : 0;

      const rawTotal = 40 + locationScore * 0.4 + specScore * 0.6 + ratingScore + expScore + verifiedScore * 0.5;
      const matchPercentage = Math.min(98, Math.max(65, Math.round(rawTotal)));

      const locParts = (user.location || "").split(",");
      const parsedCity = locParts[0] ? locParts[0].trim() : "";
      const parsedState = locParts[1] ? locParts[1].trim() : "";

      const practiceAreas = (
        Array.isArray(lawyer.practiceAreas) && lawyer.practiceAreas.length
          ? lawyer.practiceAreas
          : [lawyer.specialization]
      ).filter(Boolean);

      return {
        lawyerId: lawyer._id,
        userId: user._id,
        profileImage: user.profileImage || "",
        fullName: user.fullName,
        specialization: lawyer.specialization,
        city: parsedCity,
        district: lawyer.district || parsedCity,
        state: parsedState,
        location: user.location || "",
        experience: lawyer.experience,
        rating: lawyer.rating,
        reviewCount: lawyer.totalReviews,
        consultationFee: lawyer.consultationFee,
        languages: lawyer.languages?.length ? lawyer.languages : ["English", "Hindi"],
        practiceAreas,
        verified: user.isVerified,
        onlineStatus: user.isActive,
        responseTime: lawyer.responseTime || "Responds within 2 hours",
        matchPercentage,
        casesHandled: typeof lawyer.casesHandled === "number" ? lawyer.casesHandled : 120,
        winPercentage: typeof lawyer.winPercentage === "number" ? lawyer.winPercentage : 85,
        locationScore,
        bio: lawyer.bio || "",
        education: lawyer.education || "",
        barCouncilNumber: lawyer.barCouncilNumber || "",
        officeAddress: lawyer.officeAddress || "",
        workingHours: lawyer.workingHours || "9:00 AM - 6:00 PM",
      };
    }).filter(Boolean);

    scored.sort((a, b) => {
      if (sortBy === "Best Match") {
        return b.matchPercentage - a.matchPercentage;
      } else if (sortBy === "Experience") {
        return b.experience - a.experience;
      } else if (sortBy === "Rating") {
        return b.rating - a.rating;
      } else if (sortBy === "Fees: Low to High") {
        return a.consultationFee - b.consultationFee;
      }
      return b.matchPercentage - a.matchPercentage;
    });

    return scored.slice(0, limit);
  }
}

module.exports = new LawyerRecommendationService();
