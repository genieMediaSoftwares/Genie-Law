// CORS for browser clients. Credentials are allowed, so a wildcard would let
// any site call the API as the signed-in user; "*" is therefore ignored.
const { required } = require("./env");

const configuredOrigins = required("ALLOWED_ORIGINS")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (configuredOrigins.includes("*")) {
  console.warn(
    "[startup] ALLOWED_ORIGINS contains '*', which is ignored. List each browser origin explicitly."
  );
}

const allowedOrigins = new Set(configuredOrigins.filter((origin) => origin !== "*"));

// ALLOWED_ORIGINS is the only list of browser origins that may call the API
// (web app, admin panel). Native apps send no Origin header and are not
// affected. There is no automatic allowance for localhost or LAN addresses:
// add each development origin to ALLOWED_ORIGINS in backend/.env.
const isAllowedOrigin = (origin) => allowedOrigins.has(origin);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    return callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "Accept",
    "X-Requested-With",
    "Origin",
    "contentType",
    "responseType",
    "Access-Control-Allow-Headers",
    "Access-Control-Request-Headers",
  ],
  credentials: true,
};

module.exports = {
  allowedOrigins,
  isAllowedOrigin,
  corsOptions,
};
