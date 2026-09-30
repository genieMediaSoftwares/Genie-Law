const { generateAccessToken } = require("../config/jwt");

const generateToken = (user, sessionId) => {
  const payload = {
    id: user._id,
    role: user.role,
    email: user.email,
  };

  if (sessionId) {
    payload.sid = sessionId;
  }

  return generateAccessToken(payload);
};

module.exports = generateToken;
