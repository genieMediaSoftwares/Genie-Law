const User = require("../models/User");
const normalizeEmail = require("../utils/normalizeEmail");

class UserRepository {
  async create(userData) {
    return await User.create(userData);
  }

  async findByEmail(email) {
    return await User.findOne({ email: normalizeEmail(email) }).select(
      "+password"
    );
  }

  async findByMobile(mobile) {
    return await User.findOne({
      mobile: typeof mobile === "string" ? mobile.trim() : mobile,
    }).select("+password");
  }

  async findByFullName(fullName) {
    if (typeof fullName !== "string" || !fullName.trim()) {
      return null;
    }

    const escaped = fullName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return await User.findOne({
      fullName: { $regex: `^${escaped}$`, $options: "i" },
    });
  }

  async findById(id) {
    return await User.findById(id);
  }

  async update(id, data) {
    return await User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await User.findByIdAndDelete(id);
  }
}

module.exports = new UserRepository();
