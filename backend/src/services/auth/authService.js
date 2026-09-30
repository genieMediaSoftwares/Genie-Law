const crypto = require("crypto");

const userRepository = require("../../repositories/userRepository");
const generateToken = require("../../utils/generateToken");
const AppError = require("../../utils/AppError");
const AUTH_CODES = require("../../utils/authCodes");
const normalizeEmail = require("../../utils/normalizeEmail");
const sessionService = require("./sessionService");
const authLog = require("../../utils/authLog");
const { ensureAdminAccount } = require("./adminAccount");
const { required } = require("../../config/env");
const otpService = require("./otp/otpService");
const verificationToken = require("./verificationToken");
const googleAuthService = require("./googleAuthService");

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const REQUIRE_UNIQUE_FULL_NAME = false;

const duplicateKeyError = (error) => {
  if (!error || error.code !== 11000) {
    return null;
  }

  const field =
    Object.keys(error.keyPattern || {})[0] ||
    (/email/i.test(error.message || "")
      ? "email"
      : /mobile/i.test(error.message || "")
      ? "mobile"
      : null);

  if (field === "email") {
    return new AppError(
      "This email is already registered. Please use another email or sign in.",
      409,
      AUTH_CODES.EMAIL_ALREADY_REGISTERED
    );
  }

  if (field === "mobile") {
    return new AppError(
      "This mobile number is already registered. Please use another number or sign in.",
      409,
      AUTH_CODES.MOBILE_ALREADY_REGISTERED
    );
  }

  if (field === "fullName") {
    return new AppError(
      "This name is already in use. Please choose another name.",
      409,
      AUTH_CODES.NAME_ALREADY_IN_USE
    );
  }

  return new AppError(
    "An account with these details already exists.",
    409,
    AUTH_CODES.EMAIL_ALREADY_REGISTERED
  );
};

const publicUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile || "",
  role: user.role,
  profileImage: user.profileImage,
  location: user.location || "",
  emailVerified: Boolean(user.emailVerifiedAt),
  mobileVerified: Boolean(user.mobileVerifiedAt),
  authProviders: user.authProviders || [],
});

// A new account must verify its email OR mobile before it can sign in.
const verificationRequired = (user) => {
  const error = new AppError(
    "Please verify your email or mobile number to continue.",
    403,
    AUTH_CODES.CONTACT_VERIFICATION_REQUIRED
  );
  error.details = {
    verificationToken: verificationToken.issue(user._id),
    channels: otpService.channelsFor(user),
    user: publicUser(user),
  };
  return error;
};

class AuthService {
  async register(userData, context = {}) {
    const email = normalizeEmail(userData.email);
    const mobile =
      typeof userData.mobile === "string"
        ? userData.mobile.trim()
        : userData.mobile;

    const emailExists = await userRepository.findByEmail(email);

    if (emailExists) {
      throw new AppError(
        "This email is already registered. Please use another email or sign in.",
        409,
        AUTH_CODES.EMAIL_ALREADY_REGISTERED
      );
    }

    const mobileExists = await userRepository.findByMobile(mobile);

    if (mobileExists) {
      throw new AppError(
        "This mobile number is already registered. Please use another number or sign in.",
        409,
        AUTH_CODES.MOBILE_ALREADY_REGISTERED
      );
    }

    if (REQUIRE_UNIQUE_FULL_NAME) {
      const nameExists = await userRepository.findByFullName(userData.fullName);

      if (nameExists) {
        throw new AppError(
          "This name is already in use. Please choose another name.",
          409,
          AUTH_CODES.NAME_ALREADY_IN_USE
        );
      }
    }

    let user;
    try {
      user = await userRepository.create({
        fullName: userData.fullName,
        email,
        mobile,
        password: userData.password,
        role: userData.role === "lawyer" ? "lawyer" : "client",
        authProviders: ["password"],
        requiresContactVerification: true,
      });
    } catch (error) {
      const duplicate = duplicateKeyError(error);
      if (duplicate) {
        throw duplicate;
      }
      throw error;
    }

    authLog("SIGNUP_PENDING_VERIFICATION", { userId: String(user._id) });

    // No session yet: the account is signed in once one contact is verified.
    return {
      verificationRequired: true,
      verificationToken: verificationToken.issue(user._id),
      channels: otpService.channelsFor(user),
      user: publicUser(user),
    };
  }

  async login(email, password, context = {}) {
    await ensureAdminAccount(email, password);
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new AppError(
        "Invalid email or password.",
        401,
        AUTH_CODES.INVALID_CREDENTIALS
      );
    }

    const isPasswordCorrect =
      await user.comparePassword(password);

    if (!isPasswordCorrect) {
      authLog("LOGIN_FAILED", {
        userId: String(user._id),
        reason: "bad_password",
      });
      throw new AppError(
        "Invalid email or password.",
        401,
        AUTH_CODES.INVALID_CREDENTIALS
      );
    }

    // New accounts sign in only after verifying their email OR mobile.
    if (user.requiresContactVerification) {
      throw verificationRequired(user);
    }

    const result = await this.startSession(user, context, "login");

    authLog("LOGIN_SUCCESS", {
      userId: String(user._id),
      deviceId: context.deviceId || "unknown",
      platform: context.platform || "unknown",
    });

    return result;
  }

  // Creates a session through the existing session system for any sign-in path.
  async startSession(user, context = {}, reason = "login") {
    const { deviceId, ipAddress, deviceName, platform, userAgent } = context;

    await sessionService.revokeSessionsForDevice(user._id, deviceId);

    const { session, refreshToken } = await sessionService.createSession({
      userId: user._id,
      deviceId,
      deviceName,
      platform,
      ipAddress,
      userAgent,
    });

    const token = generateToken(user, session.sessionId);

    authLog("SESSION_CREATED", {
      userId: String(user._id),
      sessionId: session.sessionId,
      reason,
      deviceId: deviceId || "unknown",
      platform: platform || "unknown",
    });

    return {
      token,
      refreshToken,
      expiresIn: sessionService.accessTokenTtlSeconds,
      user: publicUser(user),
    };
  }

  async requestContactOtp(rawVerificationToken, channel) {
    const user = await userRepository.findById(verificationToken.read(rawVerificationToken));
    if (!user) {
      throw new AppError("Account not found.", 404, AUTH_CODES.VERIFICATION_SESSION_EXPIRED);
    }
    return otpService.requestCode(user, channel);
  }

  // Verifies the code, then signs the user in (existing session system).
  async verifyContactOtp(rawVerificationToken, channel, code, context = {}) {
    const user = await userRepository.findById(verificationToken.read(rawVerificationToken));
    if (!user) {
      throw new AppError("Account not found.", 404, AUTH_CODES.VERIFICATION_SESSION_EXPIRED);
    }
    const verified = await otpService.verifyCode(user, channel, code);
    authLog("CONTACT_VERIFIED", { userId: String(user._id), channel });
    return this.startSession(verified, context, "contact_verified");
  }

  googleStatus() {
    return { google: googleAuthService.isConfigured() };
  }

  async googleStart(role, appRedirect) {
    return googleAuthService.start({ role, appRedirect });
  }

  async googleCallback(query) {
    return googleAuthService.callback(query);
  }

  async googleExchange(code, context = {}) {
    const user = await googleAuthService.redeem(code);
    if (!user) {
      throw new AppError("This sign-in has expired. Please try again.", 400, AUTH_CODES.OAUTH_INVALID_STATE);
    }
    return this.startSession(user, context, "google");
  }

  async logout(sessionId) {
    const revoked = await sessionService.revokeSession(sessionId);

    authLog("LOGOUT_SUCCESS", { sessionId: sessionId || "none", revoked });
    return true;
  }

  async logoutAllDevices(userId) {
    const revoked = await sessionService.revokeAllSessions(userId);

    authLog("SESSION_REVOKED", {
      userId: String(userId),
      revoked,
      reason: "logout-all",
    });
    return revoked;
  }

  async refreshSession(rawRefreshToken) {
    const rotated = await sessionService.rotateRefreshToken(rawRefreshToken);

    if (!rotated) {
      authLog("REFRESH_FAILED", { reason: "invalid_or_revoked" });
      throw new AppError(
        "Your session has ended. Please sign in again.",
        401,
        AUTH_CODES.SESSION_EXPIRED
      );
    }

    const user = await userRepository.findById(rotated.userId);

    if (!user) {
      await sessionService.revokeSession(rotated.sessionId);
      authLog("REFRESH_FAILED", { reason: "user_missing" });
      throw new AppError(
        "Your session has ended. Please sign in again.",
        401,
        AUTH_CODES.SESSION_EXPIRED
      );
    }

    const token = generateToken(user, rotated.sessionId);

    authLog("REFRESH_SUCCESS", {
      userId: String(user._id),
      sessionId: rotated.sessionId,
    });

    return {
      token,
      refreshToken: rotated.refreshToken,
      expiresIn: sessionService.accessTokenTtlSeconds,
      user: publicUser(user),
    };
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    return user;
  }

  async updateProfile(userId, updateData) {
    const user = await userRepository.update(userId, updateData);
    if (!user) {
      throw new AppError("User not found.", 404);
    }
    return {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      profileImage: user.profileImage,
      location: user.location || "",
    };
  }

  async forgotPassword(email) {
    const User = require("../../models/User");
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return;
    }

    const resetToken = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordToken = hashResetToken(resetToken);
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();

    if (required("NODE_ENV") !== "production") {
      console.log(`[dev] Password reset code for ${email}: ${resetToken}`);
    }
  }

  async resetPassword(email, token, newPassword) {
    const User = require("../../models/User");
    const user = await User.findOne({
      email: normalizeEmail(email),
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError("Invalid or expired reset token.", 400);
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    return true;
  }

  async changePassword(userId, oldPassword, newPassword) {
    const User = require("../../models/User");
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw new AppError("Incorrect old password.", 400);
    }

    user.password = newPassword;
    await user.save();

    return true;
  }
  async deleteAccount(userId, password) {
    const User = require("../../models/User");
    const Case = require("../../models/Case");
    const Appointment = require("../../models/Appointment");
    const Lawyer = require("../../models/Lawyer");

    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError("Incorrect password.", 400);
    }

    await Case.deleteMany({ client: userId });
    await Appointment.deleteMany({ $or: [{ client: userId }, { lawyer: userId }] });
    await Lawyer.deleteOne({ user: userId });
    await sessionService.revokeAllSessions(userId);
    await User.findByIdAndDelete(userId);

    return true;
  }
}

module.exports = new AuthService();