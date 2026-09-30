/**
 * Structured JSON logger with field redaction and AsyncLocalStorage context.
 *
 * Each log line is a single JSON object:
 *   { ts, level, event, requestId?, userId?, ...redacted(data) }
 *
 * Usage:
 *   const log = require("./structuredLogger");
 *   log.info("auth:login-success", { userId: "123" });
 *   log.warn("cache:miss", { key: "foo" });
 *   log.error("db:connection-failed", error, { query: "SELECT ..." });
 *
 * With request context (in middleware):
 *   log.withRequest(req, callback) - requestId is carried automatically
 */

const { AsyncLocalStorage } = require("node:async_hooks");
const { required } = require("../config/env");

// ---- Sensitive field names (case-insensitive matching) ----
const SENSITIVE_KEYS = new Set([
  "password", "token", "secret", "authorization", "cookie",
  "apikey", "api_key", "apisecret", "api_secret", "otp", "code",
  "credentials", "privatekey", "private_key", "refresh_token", "access_token",
  "card_number", "cvv", "ssn", "pan",
  "refreshtoken", "accesstoken", "jwt", "idtoken", "id_token", "secretaccesskey", "mongodb_uri",
]);

// ---- AsyncLocalStorage context ----
const storage = new AsyncLocalStorage();

// ---- Redaction ----
function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  // Limit recursion depth
  if (depth > 4) return "[max-depth]";

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redact(val, depth + 1);
    }
  }
  return result;
}

// ---- Environment detection ----
const isProd = required("NODE_ENV") === "production";

// ---- Emit ----
function emit(level, event, data) {
  const minLevel = isProd ? 1 : 0;
  const levelNum = level === "error" ? 3 : level === "warn" ? 2 : level === "info" ? 1 : 0;
  if (levelNum < minLevel && level !== "error") return;

  const ctx = storage.getStore() || {};
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
  };

  if (ctx.requestId) payload.requestId = ctx.requestId;
  if (ctx.userId) payload.userId = String(ctx.userId);
  if (ctx.method) payload.method = ctx.method;
  if (ctx.path) payload.path = ctx.path;

  // `data` is optional: log.info("event") must not throw.
  const redacted = redact(data);
  if (redacted && typeof redacted === "object" && Object.keys(redacted).length > 0) {
    Object.assign(payload, redacted);
  }

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (isProd && level !== "info") {
    console.log(line);
  } else {
    console.log(line);
  }
}

// ---- Public API ----
module.exports = {
  info: (event, data) => emit("info", event, data),
  warn: (event, data) => emit("warn", event, data),
  error: (event, errorOrData, maybeData) => {
    let data;
    if (errorOrData instanceof Error) {
      data = { message: errorOrData.message, stack: errorOrData.stack };
      if (maybeData) data = { ...data, ...redact(maybeData) };
    } else {
      data = redact(errorOrData || {});
    }
    emit("error", event, data);
  },
  debug: (event, data) => emit("debug", event, data),

  withRequest(request, fn) {
    const ctx = {
      requestId: request?.requestId || null,
      userId: request?.user?._id?.toString() || null,
      method: request?.method || null,
      path: request?.path || null,
    };
    return storage.run(ctx, fn);
  },

  getStore() {
    return storage.getStore();
  },
};
