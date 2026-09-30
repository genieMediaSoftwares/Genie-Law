const { required } = require("../config/env");
function formatMessage(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
}

const logger = {
  info: (msg, meta) => console.log(formatMessage("INFO", msg, meta)),
  warn: (msg, meta) => console.warn(formatMessage("WARN", msg, meta)),
  error: (msg, meta) => console.error(formatMessage("ERROR", msg, meta)),
  debug: (msg, meta) => {
    if (required("NODE_ENV") !== "production") {
      console.log(formatMessage("DEBUG", msg, meta));
    }
  },
};

module.exports = logger;
