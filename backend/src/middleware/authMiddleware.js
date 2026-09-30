const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sessionService = require("../services/auth/sessionService");
const AUTH_CODES = require("../utils/authCodes");
const { required } = require("../config/env");

const authMiddleware = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, required("JWT_SECRET"));

    if (decoded.sid) {
      const isActive = await sessionService.isSessionActive(decoded.sid);

      if (!isActive) {
        return res.status(401).json({
          success: false,
          message: "Your session has ended. Please sign in again.",
          code: AUTH_CODES.SESSION_EXPIRED,
        });
      }

      req.sessionId = decoded.sid;
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

module.exports = authMiddleware;
