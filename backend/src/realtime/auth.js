// Authenticates a socket namespace connection from the `auth` payload the
// client sends with CONNECT (socket.io-client `auth: { token }`).

const jwt = require("jsonwebtoken");
const { required } = require("../config/env");

async function authenticate(auth) {
  const token = auth && typeof auth.token === "string" ? auth.token.replace(/^Bearer /, "") : "";
  if (!token) throw new Error("Unauthorized: no token provided");
  let decoded;
  try {
    decoded = jwt.verify(token, required("JWT_SECRET"));
  } catch {
    throw new Error("Unauthorized: invalid or expired token");
  }
  if (decoded.sid) {
    const sessionService = require("../services/auth/sessionService");
    if (!(await sessionService.isSessionActive(decoded.sid))) {
      throw new Error("Unauthorized: session has ended");
    }
  }
  return { userId: String(decoded.id), role: decoded.role };
}

module.exports = { authenticate };
