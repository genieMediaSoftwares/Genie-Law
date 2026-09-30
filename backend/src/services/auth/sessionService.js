const crypto = require("crypto");

const RefreshToken = require("../../models/RefreshToken");
const { required } = require("../../config/env");

const parseDurationMs = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }
  if (typeof value !== "string") {
    return fallback;
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const hashRefreshToken = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

// A duration such as "15m" or "7d" from .env; an invalid value stops the server.
const durationFromEnv = (name) => {
  const ms = parseDurationMs(required(name), null);
  if (ms === null) throw new Error(`${name} must be a duration such as 15m or 7d.`);
  return ms;
};

class SessionService {
  get ttlMs() {
    return durationFromEnv("JWT_REFRESH_EXPIRES_IN");
  }

  get accessTokenTtlSeconds() {
    return Math.floor(
      durationFromEnv("JWT_EXPIRES_IN") / 1000
    );
  }

  _activeFilter(userId) {
    return {
      user: userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    };
  }

  async listActiveSessions(userId) {
    return RefreshToken.find(this._activeFilter(userId)).sort({
      createdAt: -1,
    });
  }

  async revokeSessionsForDevice(userId, deviceId) {
    if (!deviceId) {
      return 0;
    }

    const result = await RefreshToken.updateMany(
      { ...this._activeFilter(userId), deviceInfo: deviceId },
      { $set: { isRevoked: true, revokedAt: new Date() } }
    );

    return result.modifiedCount || 0;
  }

  async createSession({
    userId,
    deviceId,
    deviceName,
    platform,
    ipAddress,
    userAgent,
  }) {
    const sessionId = crypto.randomUUID();
    const refreshToken = crypto.randomBytes(32).toString("hex");

    await RefreshToken.create({
      user: userId,
      token: sessionId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      deviceInfo: deviceId || "unknown",
      deviceName: deviceName || "",
      platform: platform || "",
      ipAddress: ipAddress || "",
      userAgent: userAgent || "",
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + this.ttlMs),
      isRevoked: false,
    });

    return { session: { sessionId }, refreshToken };
  }

  async rotateRefreshToken(rawToken) {
    if (!rawToken) {
      return null;
    }

    const nextRefreshToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();

    const session = await RefreshToken.findOneAndUpdate(
      {
        refreshTokenHash: hashRefreshToken(rawToken),
        isRevoked: false,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          refreshTokenHash: hashRefreshToken(nextRefreshToken),
          lastUsedAt: now,
        },
      },
      { new: true }
    );

    if (!session) {
      return null;
    }

    return {
      sessionId: session.token,
      userId: session.user,
      refreshToken: nextRefreshToken,
    };
  }

  async revokeSession(sessionId) {
    if (!sessionId) {
      return false;
    }

    const result = await RefreshToken.updateOne(
      { token: sessionId, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date() } }
    );

    return (result.modifiedCount || 0) > 0;
  }

  async revokeAllSessions(userId) {
    const result = await RefreshToken.updateMany(
      { user: userId, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date() } }
    );

    return result.modifiedCount || 0;
  }

  async isSessionActive(sessionId) {
    if (!sessionId) {
      return false;
    }

    const session = await RefreshToken.exists({
      token: sessionId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    return Boolean(session);
  }
}

module.exports = new SessionService();
module.exports.parseDurationMs = parseDurationMs;
module.exports.hashRefreshToken = hashRefreshToken;
