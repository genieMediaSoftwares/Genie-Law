// MongoDB connection pool and behaviour settings. Every value comes from the
// environment through config/env.js; there are no built-in defaults.
//
//   DB_AUTO_INDEX         "true" or "false". "true" lets Mongoose build the
//                         indexes defined in the models (local development, or
//                         the first deploy after a model change); keep it
//                         "false" in production otherwise.
//   DB_POOL_MAX           maxPoolSize
//   DB_POOL_MIN           minPoolSize
//   DB_MAX_IDLE_TIME_MS   maxIdleTimeMS
//   DB_SOCKET_TIMEOUT_MS  socketTimeoutMS
//
// Each setting matches the Mongoose option of the same name. They control how
// many sockets the driver keeps open to Atlas, how long an idle socket lives,
// and when the driver gives up on a slow operation.

const { required, requiredNumber } = require("./env");

function readAutoIndex() {
  const value = required("DB_AUTO_INDEX").toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new Error(`DB_AUTO_INDEX must be "true" or "false" (got "${value}").`);
  }
  return value === "true";
}

module.exports = {
  autoIndex: readAutoIndex(),

  // Atlas M10 caps at ~500 connections, M30 at ~1500. Raise DB_POOL_MAX only
  // after observing pool exhaustion under load.
  maxPoolSize: requiredNumber("DB_POOL_MAX"),
  minPoolSize: requiredNumber("DB_POOL_MIN"),

  // Idle socket TTL — past this the driver closes the socket. Keeps the Atlas
  // connection list small and frees the TLS slot on the Render side.
  maxIdleTimeMS: requiredNumber("DB_MAX_IDLE_TIME_MS"),

  // How long a single operation can wait on Atlas before the driver fails
  // it. The Node-side request timeout is enforced separately on top of this.
  socketTimeoutMS: requiredNumber("DB_SOCKET_TIMEOUT_MS"),

  // An unreachable Atlas fails fast instead of hanging the request.
  serverSelectionTimeoutMS: 15_000,
};
