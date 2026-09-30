// How OTP codes reach the user, chosen by OTP_DELIVERY (backend/.env).
//
//   local  Local development only. Writes the code to the server log and
//          hands it back to the caller so the app can show it in a clearly
//          marked development banner. Refused whenever NODE_ENV=production.
//
// A production provider (email API / SMS gateway) is added as another adapter
// with the same `deliver({ channel, destination, code })` method and its keys
// as Render environment variables; otpService does not change.

const { required } = require("../../../config/env");

class LocalDevelopmentDelivery {
  get id() {
    return "local";
  }

  async deliver({ channel, destination, code }) {
    // Development only (see createDelivery): never reached in production.
    console.log(`[dev-otp] ${channel} code for ${destination}: ${code}`);
    return { devCode: code };
  }
}

const ADAPTERS = {
  local: () => new LocalDevelopmentDelivery(),
};

function createDelivery() {
  const id = required("OTP_DELIVERY");
  if (id === "local" && required("NODE_ENV") === "production") {
    throw new Error("OTP_DELIVERY=local is for local development only and cannot run in production.");
  }
  const factory = ADAPTERS[id];
  if (!factory) {
    throw new Error(`OTP_DELIVERY "${id}" has no adapter. Available: ${Object.keys(ADAPTERS).join(", ")}.`);
  }
  return factory();
}

module.exports = { createDelivery };
