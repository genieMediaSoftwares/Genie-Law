const { body } = require("express-validator");

const signupValidation = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full Name is required")
    .isLength({ min: 3 })
    .withMessage("Full Name must be at least 3 characters"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("mobile")
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Enter a valid 10-digit mobile number"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("role")
    .optional()
    .isIn(["client", "lawyer"])
    .withMessage("Role must be client or lawyer"),
];

const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

const emailValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
];

module.exports = {
  signupValidation,
  loginValidation,
  emailValidation,
};