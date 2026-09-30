const authService = require("../../services/auth/authService");
const storageService = require("../../services/storageService");
const ApiResponse = require("../../config/ApiResponse");

const deviceContext = (req) => ({
  deviceId: req.body?.deviceId || req.get("X-Device-Id") || undefined,
  deviceName: req.body?.deviceName || req.get("X-Device-Name") || undefined,
  platform: req.body?.platform || req.get("X-Device-Platform") || undefined,
  userAgent: req.get("User-Agent") || undefined,
  ipAddress: req.ip,
});

class AuthController {
  async signup(req, res, next) {
    try {
      const result = await authService.register(req.body, deviceContext(req));

      return ApiResponse.success(
        res,
        "Account created. Verify your email or mobile number to continue.",
        result,
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const result = await authService.login(
        email,
        password,
        deviceContext(req)
      );

      return ApiResponse.success(
        res,
        "Login successful.",
        result
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/otp/request { verificationToken, channel: "email" | "mobile" }
  async requestOtp(req, res, next) {
    try {
      const result = await authService.requestContactOtp(req.body?.verificationToken, req.body?.channel);
      return ApiResponse.success(res, "Verification code sent.", result);
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/otp/verify { verificationToken, channel, code } -> session
  async verifyOtp(req, res, next) {
    try {
      const result = await authService.verifyContactOtp(
        req.body?.verificationToken,
        req.body?.channel,
        req.body?.code,
        deviceContext(req)
      );
      return ApiResponse.success(res, "Verified. You are signed in.", result);
    } catch (error) {
      next(error);
    }
  }

  // GET /auth/providers — which sign-in methods this server offers.
  async providers(req, res, next) {
    try {
      return ApiResponse.success(res, "Sign-in providers.", authService.googleStatus());
    } catch (error) {
      next(error);
    }
  }

  // GET /auth/google/start?role=client|lawyer&redirect=<app URL>
  async googleStart(req, res, next) {
    try {
      const url = await authService.googleStart(req.query.role, req.query.redirect);
      return res.redirect(302, url);
    } catch (error) {
      next(error);
    }
  }

  // GET /auth/google/callback (Google redirects here)
  async googleCallback(req, res, next) {
    try {
      const target = await authService.googleCallback({
        state: req.query.state,
        code: req.query.code,
        error: req.query.error,
      });
      return res.redirect(302, target);
    } catch (error) {
      next(error);
    }
  }

  // POST /auth/google/exchange { code } -> session
  async googleExchange(req, res, next) {
    try {
      const result = await authService.googleExchange(req.body?.code, deviceContext(req));
      return ApiResponse.success(res, "Signed in with Google.", result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout(req.sessionId);

      return ApiResponse.success(res, "Logged out successfully.");
    } catch (error) {
      next(error);
    }
  }

  async logoutAllDevices(req, res, next) {
    try {
      const revoked = await authService.logoutAllDevices(req.user._id);

      return ApiResponse.success(res, "Signed out on all devices.", {
        sessionsRevoked: revoked,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const result = await authService.refreshSession(req.body?.refreshToken);

      return ApiResponse.success(res, "Token refreshed.", result);
    } catch (error) {
      next(error);
    }
  }

  async profile(req, res, next) {
    try {
      const user = await authService.getProfile(
        req.user._id
      );

      return ApiResponse.success(
        res,
        "Profile fetched successfully.",
        user
      );
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { fullName, mobile, location } = req.body;
      const user = await authService.updateProfile(req.user._id, { fullName, mobile, location });

      return ApiResponse.success(
        res,
        "Profile updated successfully.",
        user
      );
    } catch (error) {
      next(error);
    }
  }

  async uploadProfileImage(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, "No image file uploaded.", 400);
      }
      const metadata = await storageService.uploadFile(req.file, "profile");
      const user = await authService.updateProfile(req.user._id, { profileImage: metadata.url });

      return ApiResponse.success(
        res,
        "Profile image uploaded successfully.",
        user
      );
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return ApiResponse.error(res, "Email is required.", 400);
      }
      await authService.forgotPassword(email);

      return ApiResponse.success(
        res,
        "If that email is registered, a reset code has been sent."
      );
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { email, token, newPassword } = req.body;
      if (!email || !token || !newPassword) {
        return ApiResponse.error(res, "Email, token, and newPassword are required.", 400);
      }
      await authService.resetPassword(email, token, newPassword);
      return ApiResponse.success(res, "Password has been reset successfully.");
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return ApiResponse.error(res, "Old and new passwords are required.", 400);
      }
      await authService.changePassword(req.user._id, oldPassword, newPassword);
      return ApiResponse.success(res, "Password changed successfully.");
    } catch (error) {
      next(error);
    }
  }

  async uploadBarCertificate(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, "No certificate file uploaded.", 400);
      }
      const Lawyer = require("../../models/Lawyer");
      const metadata = await storageService.uploadFile(req.file, "certificates");
      const lawyer = await Lawyer.findOneAndUpdate(
        { user: req.user._id },
        { barCertificate: metadata.url },
        { new: true }
      );
      if (!lawyer) {
        return ApiResponse.error(res, "Lawyer profile not found.", 404);
      }
      return ApiResponse.success(res, "Bar certificate uploaded successfully.", lawyer);
    } catch (error) {
      next(error);
    }
  }
  async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;
      if (!password) {
        return ApiResponse.error(res, "Password is required to delete account.", 400);
      }
      await authService.deleteAccount(req.user._id, password);
      return ApiResponse.success(res, "Account deleted successfully.");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();