const express = require("express");

const router = express.Router();

const authController = require("../controllers/auth/authController");

const authMiddleware = require("../middleware/authMiddleware");

const validationMiddleware = require("../middleware/validationMiddleware");

const {
  signupValidation,
  loginValidation,
  emailValidation,
} = require("../validations/authValidation");

router.post(
  "/signup",
  signupValidation,
  validationMiddleware,
  authController.signup
);

router.post(
  "/login",
  loginValidation,
  validationMiddleware,
  authController.login
);

router.get(
  "/profile",
  authMiddleware,
  authController.profile
);

const upload = require("../middleware/upload.middleware");

router.put(
  "/profile",
  authMiddleware,
  authController.updateProfile
);

router.post(
  "/profile/image",
  authMiddleware,
  upload.single("image"),
  authController.uploadProfileImage
);

router.post(
  "/forgot-password",
  emailValidation,
  validationMiddleware,
  authController.forgotPassword
);
router.post(
  "/reset-password",
  emailValidation,
  validationMiddleware,
  authController.resetPassword
);
router.post("/change-password", authMiddleware, authController.changePassword);
router.post("/delete-account", authMiddleware, authController.deleteAccount);


// Contact verification (email OR mobile OTP) for new accounts.
router.post("/otp/request", authController.requestOtp);
router.post("/otp/verify", authController.verifyOtp);

// Google sign-in (OAuth handled by this backend).
router.get("/providers", authController.providers);
router.get("/google/start", authController.googleStart);
router.get("/google/callback", authController.googleCallback);
router.post("/google/exchange", authController.googleExchange);

router.post("/logout", authMiddleware, authController.logout);

router.post("/refresh-token", authController.refreshToken);

router.post("/logout-all", authMiddleware, authController.logoutAllDevices);

router.post(
  "/profile/certificate",
  authMiddleware,
  upload.single("certificate"),
  authController.uploadBarCertificate
);

module.exports = router;