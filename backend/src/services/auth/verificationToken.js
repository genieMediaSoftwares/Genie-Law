// A short-lived token that lets a signed-up but not-yet-verified user request
// and enter OTP codes, and nothing else.
//
// It is signed with a key derived from JWT_SECRET, never JWT_SECRET itself, so
// it can never be accepted where a session access token is expected.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const AppError = require("../../utils/AppError");
const AUTH_CODES = require("../../utils/authCodes");
const { required } = require("../../config/env");

const PURPOSE = "contact_verification";
const LIFETIME = "30m";

const signingKey = () =>
  crypto.createHmac("sha256", required("JWT_SECRET")).update(PURPOSE).digest("hex");

function issue(userId) {
  return jwt.sign({ uid: String(userId), typ: PURPOSE }, signingKey(), { expiresIn: LIFETIME });
}

function read(token) {
  try {
    const payload = jwt.verify(String(token || ""), signingKey());
    if (payload.typ !== PURPOSE || !payload.uid) throw new Error("wrong token type");
    return payload.uid;
  } catch {
    throw new AppError(
      "Your verification session has expired. Please sign in again to get a new code.",
      401,
      AUTH_CODES.VERIFICATION_SESSION_EXPIRED
    );
  }
}

module.exports = { issue, read };
