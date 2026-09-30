// MongoDB connection pool and behaviour settings. All values come from env
// through config/env.js (no hardcoded production numbers).
//
//   DB_AUTO_INDEX         "true"  → Mongoose autoIndex enabled (first-deploy only).
//                         anything else (including unset) → autoIndex disabled.
//                         Indexes live in the model definitions; build them once
//                         during the first deploy and turn autoIndex off after.
//   DB_POOL_MAX           maxPoolSize (default 50)
//   DB_POOL_MIN           minPoolSize (default 5)
//   DB_MAX_IDLE_TIME_MS   maxIdleTimeMS (default 60000)
//   DB_SOCKET_TIMEOUT_MS  socketTimeoutMS (default 45000)
//
// Each setting matches the Mongoose option of the same name. They control how
// many sockets the driver keeps open to Atlas, how long an idle socket lives,
// and when the driver gives up on a slow operation.

const { optionalNumber, optional } = require("./env");

const isProd = optional("NODE_ENV") === "production";

// In production, autoIndex is opt-in (set DB_AUTO_INDEX=true on the first
// deploy after a model change to let Mongoose build the new index, then unset
// it). Outside production it stays on so a fresh checkout gets its indexes.
const AUTO_INDEX = isProd ? optional("DB_AUTO_INDEX").toLowerCase() === "true" : true;

module.exports = {
  autoIndex: AUTO_INDEX,

  // 50 / 5 fits the current Render instance. Atlas M10 caps at ~500, M30 at
  // ~1500, so this stays well under the cluster limit. Raise DB_POOL_MAX only
  // after observing pool exhaustion under load.
  maxPoolSize: optionalNumber("DB_POOL_MAX", 50),
  minPoolSize: optionalNumber("DB_POOL_MIN", 5),

  // Idle socket TTL — past this the driver closes the socket. Keeps the Atlas
  // connection list small and frees the TLS slot on the Render side.
  maxIdleTimeMS: optionalNumber("DB_MAX_IDLE_TIME_MS", 60_000),

  // How long a single operation can wait on Atlas before the driver fails
  // it. The Node-side request timeout is enforced separately on top of this.
  socketTimeoutMS: optionalNumber("DB_SOCKET_TIMEOUT_MS", 45_000),

  // Keep the existing 15-second server selection timeout so an unreachable
  // Atlas fails fast instead of hanging the request.
  serverSelectionTimeoutMS: 15_000,
};
