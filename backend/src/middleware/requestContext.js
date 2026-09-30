/**
 * Request context middleware.
 *
 * Seeds AsyncLocalStorage context for structuredLogger so every log
 * emitted downstream carries requestId, userId, method, and path.
 */

const crypto = globalThis.crypto || require("node:crypto");
const log = require("../utils/structuredLogger");

function requestContext() {
  return function(req, res, next) {
    const requestId = (req.headers["x-request-id"] || req.headers["cf-ray"] ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 8))
    ).toString().slice(0, 64);

    req.requestId = requestId;
    req.log = log;
    res.setHeader("X-Request-Id", requestId);

    log.withRequest(req, function() {
      log.info("request:start", { method: req.method, path: req.path, ip: req.ip });
      next();
    });
  };
}

module.exports = { requestContext };
