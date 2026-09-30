// One-time codes that verify a user's email OR mobile number.
//
// Settings (backend/.env; Render environment variables in production):
//   OTP_SECRET                    HMAC key for stored codes (secret)
//   OTP_TTL_SECONDS               how long a code is valid
//   OTP_MAX_ATTEMPTS              wrong guesses before the code is burned
//   OTP_RESEND_COOLDOWN_SECONDS   wait between sends to one contact
//   OTP_MAX_SENDS_PER_HOUR        sends per contact per hour
//   OTP_DELIVERY                  delivery adapter (otp/delivery.js)
//
// Codes come from crypto.randomInt, are stored only as a salted HMAC, are
// single-use, and every new code invalidates the previous ones for that contact.

const crypto = require("crypto");

const AuthOtp = require("../../../models/AuthOtp");
const User = require("../../../models/User");
const AppError = require("../../../utils/AppError");
const AUTH_CODES = require("../../../utils/authCodes");
const { required, requiredNumber } = require("../../../config/env");
const { createDelivery } = require("./delivery");

const CODE_DIGITS = 6;
const CHANNELS = ["email", "mobile"];

const hashCode = (salt, code) =>
  crypto.createHmac("sha256", required("OTP_SECRET")).update(`${salt}:${code}`).digest("hex");

const sameHash = (a, b) => {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const maskEmail = (email) => {
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
};
const maskMobile = (mobile) => {
  const digits = String(mobile);
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const destinationOf = (user, channel) => (channel === "email" ? user.email : user.mobile);
const verifiedField = (channel) => (channel === "email" ? "emailVerifiedAt" : "mobileVerifiedAt");

// What the verification screen may show: which contacts exist, masked.
function channelsFor(user) {
  return {
    email: user.email ? { destination: maskEmail(user.email), verified: Boolean(user.emailVerifiedAt) } : null,
    mobile: user.mobile ? { destination: maskMobile(user.mobile), verified: Boolean(user.mobileVerifiedAt) } : null,
  };
}

const assertChannel = (user, channel) => {
  if (!CHANNELS.includes(channel)) {
    throw new AppError("Choose email or mobile.", 400, AUTH_CODES.OTP_INVALID_CHANNEL);
  }
  if (!destinationOf(user, channel)) {
    throw new AppError(`This account has no ${channel} to verify.`, 400, AUTH_CODES.OTP_INVALID_CHANNEL);
  }
  if (user[verifiedField(channel)]) {
    throw new AppError(`Your ${channel} is already verified.`, 409, AUTH_CODES.ALREADY_VERIFIED);
  }
};

async function requestCode(user, channel) {
  assertChannel(user, channel);

  const now = Date.now();
  const cooldownMs = requiredNumber("OTP_RESEND_COOLDOWN_SECONDS") * 1000;
  const recent = await AuthOtp.find({
    user: user._id,
    channel,
    createdAt: { $gte: new Date(now - 60 * 60 * 1000) },
  }).sort({ createdAt: -1 });

  if (recent[0]) {
    const waitMs = new Date(recent[0].createdAt).getTime() + cooldownMs - now;
    if (waitMs > 0) {
      const error = new AppError(
        `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`,
        429,
        AUTH_CODES.OTP_RESEND_COOLDOWN
      );
      error.details = { retryAfterSeconds: Math.ceil(waitMs / 1000) };
      throw error;
    }
  }
  if (recent.length >= requiredNumber("OTP_MAX_SENDS_PER_HOUR")) {
    throw new AppError("Too many codes requested. Please try again in an hour.", 429, AUTH_CODES.OTP_RATE_LIMITED);
  }

  // Only the newest code can ever be used.
  await AuthOtp.updateMany(
    { user: user._id, channel, consumedAt: null, invalidatedAt: null },
    { invalidatedAt: new Date(now) }
  );

  const code = String(crypto.randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
  const salt = crypto.randomBytes(16).toString("hex");
  const ttlSeconds = requiredNumber("OTP_TTL_SECONDS");
  const destination = destinationOf(user, channel);

  await AuthOtp.create({
    user: user._id,
    channel,
    destination,
    codeHash: hashCode(salt, code),
    salt,
    attempts: 0,
    expiresAt: new Date(now + ttlSeconds * 1000),
  });

  const delivered = await createDelivery().deliver({ channel, destination, code });

  return {
    channel,
    destination: channel === "email" ? maskEmail(destination) : maskMobile(destination),
    expiresInSeconds: ttlSeconds,
    resendAfterSeconds: Math.ceil(cooldownMs / 1000),
    // Present only with the local development delivery adapter.
    ...(delivered && delivered.devCode ? { devCode: delivered.devCode } : {}),
  };
}

// Checks a code; on success marks the contact verified and lifts the
// verification requirement. Returns the updated user.
async function verifyCode(user, channel, code) {
  assertChannel(user, channel);
  if (!/^\d{6}$/.test(String(code || ""))) {
    throw new AppError("Enter the 6-digit code.", 400, AUTH_CODES.OTP_INVALID);
  }

  const otp = await AuthOtp.findOne({ user: user._id, channel, consumedAt: null, invalidatedAt: null })
    .select("+codeHash +salt")
    .sort({ createdAt: -1 });
  if (!otp) {
    throw new AppError("No active code. Please request a new one.", 400, AUTH_CODES.OTP_NOT_FOUND);
  }
  if (new Date(otp.expiresAt).getTime() <= Date.now()) {
    throw new AppError("This code has expired. Please request a new one.", 410, AUTH_CODES.OTP_EXPIRED);
  }

  const maxAttempts = requiredNumber("OTP_MAX_ATTEMPTS");
  if (otp.attempts >= maxAttempts) {
    throw new AppError("Too many wrong attempts. Please request a new code.", 429, AUTH_CODES.OTP_TOO_MANY_ATTEMPTS);
  }

  if (!sameHash(otp.codeHash, hashCode(otp.salt, String(code)))) {
    const attempts = otp.attempts + 1;
    await AuthOtp.findByIdAndUpdate(otp._id, {
      attempts,
      ...(attempts >= maxAttempts ? { invalidatedAt: new Date() } : {}),
    });
    if (attempts >= maxAttempts) {
      throw new AppError("Too many wrong attempts. Please request a new code.", 429, AUTH_CODES.OTP_TOO_MANY_ATTEMPTS);
    }
    const error = new AppError("That code is incorrect.", 400, AUTH_CODES.OTP_INVALID);
    error.details = { attemptsRemaining: maxAttempts - attempts };
    throw error;
  }

  // Single use: only one request can consume it.
  const consumed = await AuthOtp.findOneAndUpdate(
    { _id: otp._id, consumedAt: null, invalidatedAt: null },
    { consumedAt: new Date() },
    { new: true }
  );
  if (!consumed) {
    throw new AppError("This code was already used. Please request a new one.", 400, AUTH_CODES.OTP_NOT_FOUND);
  }

  return User.findByIdAndUpdate(
    user._id,
    { [verifiedField(channel)]: new Date(), requiresContactVerification: false },
    { new: true }
  );
}

module.exports = { requestCode, verifyCode, channelsFor };
