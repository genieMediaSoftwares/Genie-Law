// Server-level settings read from the environment (no built-in defaults).
//
//   REQUEST_TIMEOUT_MS   Hard timeout for ordinary API requests. Upload,
//                        download, AI, and Socket.IO paths are excluded by app.js.

const { requiredNumber } = require("./env");

module.exports.DEFAULT_REQUEST_TIMEOUT_MS = requiredNumber("REQUEST_TIMEOUT_MS");
