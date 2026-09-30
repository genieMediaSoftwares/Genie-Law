// Request timeout middleware. Wraps each ordinary API request in a timer;
// paths that legitimately run long (uploads, downloads, AI, Socket.IO,
// health) bypass the timer.
//
// The timeout is configurable via REQUEST_TIMEOUT_MS (default 30 000 ms).
// On expiry the response is 503 Service Temporarily Unavailable with no
// sensitive details.

const serverConfig = require("../config/server");
const log = require("../utils/structuredLogger");

const DEFAULT_MS = serverConfig.DEFAULT_REQUEST_TIMEOUT_MS;

// Paths that carry their own timeouts or depend on slow external services.
const EXCLUDED_PATHS = new Set([
  "/health",
  "/health/ready",
  "/metrics",
  "/socket.io",
  "/uploads",
  "/api/ai",
  "/api/documents/upload",
  "/api/documents/optimize",
]);

function isExcluded(path) {
  for (const prefix of EXCLUDED_PATHS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function requestTimeout(ms = DEFAULT_MS) {
  if (ms <= 0) return (req, res, next) => next();

  return function requestTimeoutMiddleware(req, res, next) {
    if (isExcluded(req.path)) return next();

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        log.warn("request:timeout", { method: req.method, path: req.path, ip: req.ip, timeoutMs: ms });
        res.status(503).json({
          success: false,
          message: "The request took too long to process. Please try again.",
          code: "REQUEST_TIMEOUT",
        });
      }
    }, ms);

    // Clear the timer on any response finish.
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}

module.exports = requestTimeout;
