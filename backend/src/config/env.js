// Every setting comes from backend/.env locally and from the service's
// environment variables on Render. There are no built-in fallbacks: a required
// setting that is missing stops the server with a message naming it.
//
// dotenv never overrides a variable that is already set, so on Render (where
// there is no .env file) the dashboard values are used as they are.

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const read = (name) => String(process.env[name] ?? "").trim();

const missing = (name) =>
  new Error(`${name} is not set. Add it to backend/.env (or the service's environment variables on Render).`);

// A value the server cannot run without.
function required(name) {
  const value = read(name);
  if (!value) throw missing(name);
  return value;
}

// A value whose absence switches a feature off (e.g. an optional API key).
function optional(name) {
  return read(name);
}

function requiredNumber(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number (got "${read(name)}").`);
  }
  return value;
}

// Settings every request path depends on. They are checked together when the
// server starts, so a misconfigured deploy fails at boot with the full list
// instead of on the first request that happens to need one of them.
// Feature settings (Google sign-in, Places, payments gateway keys, ...) are
// read where they are used and stay optional or feature-scoped.
const STARTUP_REQUIRED = [
  "NODE_ENV",
  "PORT",
  "TRUST_PROXY",
  "ALLOWED_ORIGINS",
  "MONGODB_URI",
  "FILE_STORAGE",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
  "ENCRYPTION_SECRET",
  "OTP_SECRET",
  "REQUEST_TIMEOUT_MS",
  "DB_AUTO_INDEX",
  "DB_POOL_MAX",
  "DB_POOL_MIN",
  "DB_MAX_IDLE_TIME_MS",
  "DB_SOCKET_TIMEOUT_MS",
];

// Throws one error listing every missing startup setting, including the ones
// the chosen FILE_STORAGE mode needs (config/storage.js).
function validateStartupEnv() {
  const absent = STARTUP_REQUIRED.filter((name) => !read(name));
  if (!absent.length) {
    const { getStorageMode, requiredFor } = require("./storage");
    absent.push(...requiredFor(getStorageMode()).filter((name) => !read(name)));
  }
  if (absent.length) {
    throw new Error(
      `Missing required configuration: ${absent.join(", ")}. ` +
        "Set them in backend/.env locally, or in the service's environment variables on Render."
    );
  }
}

module.exports = {
  required,
  optional,
  requiredNumber,
  validateStartupEnv,
  STARTUP_REQUIRED,
};
