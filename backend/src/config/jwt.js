const jwt = require("jsonwebtoken");
const { required } = require("./env");

const generateAccessToken = (payload) => {
  return jwt.sign(payload, required("JWT_SECRET"), {
    expiresIn: required("JWT_EXPIRES_IN"),
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, required("JWT_SECRET"));
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
};