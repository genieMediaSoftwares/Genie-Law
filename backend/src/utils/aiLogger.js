const logger = require("./logger");

const SCOPE = "ai-smart-case";

function normalise(meta = {}) {
  const out = { scope: SCOPE };
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "object" && value.toString ? value.toString() : value;
  }
  return out;
}

function serialiseError(err) {
  if (!err) return { error: "unknown" };
  if (err instanceof Error) {
    return {
      error: err.message,
      errorName: err.name,
      stack: (err.stack || "").split("\n").slice(0, 6).join(" | "),
    };
  }
  return { error: String(err) };
}

module.exports = {
  debug: (event, meta) => logger.debug(event, normalise(meta)),
  info: (event, meta) => logger.info(event, normalise(meta)),
  warn: (event, meta) => logger.warn(event, normalise(meta)),
  error: (event, err, meta) =>
    logger.error(event, { ...normalise(meta), ...serialiseError(err) }),
};
