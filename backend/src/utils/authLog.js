const logger = require("./logger");

const FORBIDDEN_KEYS =
  /(password|passwd|secret|token|authorization|auth|credential|otp|code|hash|pin)/i;

const MAX_VALUE_LENGTH = 64;

const sanitise = (meta = {}) => {
  const safe = {};

  for (const [key, value] of Object.entries(meta)) {
    const isAllowedId = /^(sessionId|userId)$/.test(key);

    if (!isAllowedId && FORBIDDEN_KEYS.test(key)) {
      continue;
    }

    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) {
      safe[key] = `${value.slice(0, 8)}…(${value.length} chars)`;
      continue;
    }

    safe[key] = value;
  }

  return safe;
};

const authLog = (event, meta = {}) => {
  const failed = /FAILED/.test(event);
  const line = `AUTH ${event}`;

  if (failed) {
    logger.warn(line, sanitise(meta));
    return;
  }

  logger.info(line, sanitise(meta));
};

module.exports = authLog;
module.exports.sanitise = sanitise;
