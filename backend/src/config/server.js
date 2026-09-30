// Server-level tunables read from env. Each value has a production-safe
// default; override in Render environment variables as needed.
//
//   REQUEST_TIMEOUT_MS   Hard timeout for ordinary API requests (default 30 s).
//                         Upload, download, AI, and Socket.IO paths are
//                         excluded by app.js.

const { requiredNumber, optionalNumber } = require("./env");

// 30-second ceiling for normal HTTP requests. Upload endpoints, download
// endpoints, AI endpoints, Socket.IO, and health checks bypass this.
module.exports.DEFAULT_REQUEST_TIMEOUT_MS = optionalNumber("REQUEST_TIMEOUT_MS", 30_000);
