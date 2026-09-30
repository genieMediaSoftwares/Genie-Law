// The admin panel's account, configured by ADMIN_EMAIL and ADMIN_PASSWORD
// (backend/.env locally; Render environment variables in production).
//
// It is created the first time someone signs in with ADMIN_EMAIL and the
// matching ADMIN_PASSWORD while no account with that email exists, so a new
// database needs no separate seeding step. An existing account is never
// changed here: once created, its password is managed like any other.

const User = require("../../models/User");
const normalizeEmail = require("../../utils/normalizeEmail");
const { required } = require("../../config/env");

const configured = () => {
  const email = normalizeEmail(required("ADMIN_EMAIL"));
  const password = required("ADMIN_PASSWORD");
  return email && password.length >= 6 ? { email, password } : null;
};

// Returns true when it created the admin account for this sign-in attempt.
async function ensureAdminAccount(email, password) {
  const admin = configured();
  if (!admin || normalizeEmail(email || "") !== admin.email || password !== admin.password) {
    return false;
  }
  if (await User.exists({ email: admin.email })) return false;

  try {
    await User.create({
      fullName: "Administrator",
      email: admin.email,
      // Required and unique on every account; the admin never signs in by mobile.
      mobile: required("ADMIN_MOBILE"),
      password: admin.password,
      role: "admin",
      isVerified: true,
      isActive: true,
    });
    console.log(`[admin] created the admin account ${admin.email}`);
    return true;
  } catch (error) {
    // A concurrent sign-in created it first.
    if (error && error.code === 11000) return false;
    throw error;
  }
}

module.exports = { ensureAdminAccount };
