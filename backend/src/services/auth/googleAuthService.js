// Google sign-in (OAuth 2.0 authorization code + PKCE, OpenID Connect).
//
//   app ── GET /api/auth/google/start?role&redirect ──> backend ──302──> Google
//   Google ── GET /api/auth/google/callback?code&state ──> backend
//        backend: checks state, exchanges the code (client secret stays here),
//        has Google validate the ID token, finds/creates/links the user,
//        then 302s back to the app with a one-time code
//   app ── POST /api/auth/google/exchange { code } ──> existing session + JWT
//
// Settings (backend/.env; Render environment variables in production):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   empty = Google sign-in off
//   GOOGLE_AUTH_REDIRECT_URI                 this backend's callback URL
//   APP_AUTH_REDIRECT_URIS                   where the app may be sent back to

const crypto = require("crypto");

const OAuthFlow = require("../../models/OAuthFlow");
const User = require("../../models/User");
const AppError = require("../../utils/AppError");
const AUTH_CODES = require("../../utils/authCodes");
const normalizeEmail = require("../../utils/normalizeEmail");
const { required, optional } = require("../../config/env");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

const FLOW_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");

const isConfigured = () => Boolean(optional("GOOGLE_CLIENT_ID") && optional("GOOGLE_CLIENT_SECRET"));

const assertConfigured = () => {
  if (!isConfigured()) {
    throw new AppError("Google sign-in is not configured on this server.", 503, AUTH_CODES.GOOGLE_NOT_CONFIGURED);
  }
};

// Exact-match allow-list, so the one-time code is only ever sent to our apps.
const allowedAppRedirects = () =>
  required("APP_AUTH_REDIRECT_URIS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

function assertAppRedirect(redirect) {
  if (!allowedAppRedirects().includes(String(redirect || ""))) {
    throw new AppError("This app address is not allowed for sign-in.", 400, AUTH_CODES.OAUTH_INVALID_REDIRECT);
  }
}

const withParams = (base, params) => {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
};

// Step 1: returns the Google URL to open.
async function start({ role, appRedirect }) {
  assertConfigured();
  if (role !== "client" && role !== "lawyer") {
    throw new AppError("Choose client or lawyer.", 400, AUTH_CODES.OAUTH_INVALID_ROLE);
  }
  assertAppRedirect(appRedirect);

  const state = randomToken();
  const codeVerifier = randomToken();
  const nonce = randomToken();
  await OAuthFlow.create({
    provider: "google",
    stateHash: sha256(state),
    role,
    appRedirect,
    codeVerifier,
    nonce,
    expiresAt: new Date(Date.now() + FLOW_TTL_MS),
  });

  return withParams(GOOGLE_AUTH_URL, {
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: required("GOOGLE_AUTH_REDIRECT_URI"),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: crypto.createHash("sha256").update(codeVerifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
}

async function exchangeCodeForIdentity(code, flow) {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: required("GOOGLE_AUTH_REDIRECT_URI"),
      grant_type: "authorization_code",
      code_verifier: flow.codeVerifier,
    }),
  });
  const tokens = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokens.id_token) {
    throw new AppError("Google did not accept the sign-in.", 401, AUTH_CODES.GOOGLE_AUTH_FAILED);
  }

  // Google checks the ID token's signature and expiry; we check it is ours.
  const infoResponse = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(tokens.id_token)}`);
  const claims = await infoResponse.json().catch(() => ({}));
  const valid =
    infoResponse.ok &&
    claims.aud === required("GOOGLE_CLIENT_ID") &&
    GOOGLE_ISSUERS.has(claims.iss) &&
    Number(claims.exp) * 1000 > Date.now() &&
    claims.nonce === flow.nonce &&
    (claims.email_verified === true || claims.email_verified === "true") &&
    claims.sub &&
    claims.email;
  if (!valid) {
    throw new AppError("Google sign-in could not be verified.", 401, AUTH_CODES.GOOGLE_AUTH_FAILED);
  }
  return { sub: String(claims.sub), email: normalizeEmail(claims.email), name: claims.name || "", picture: claims.picture || "" };
}

// Finds the account for a verified Google identity, linking or creating it.
// An existing account keeps its role; the requested role only applies to new ones.
async function userForIdentity(identity, role) {
  let user = await User.findOne({ googleId: identity.sub });

  if (!user) {
    user = await User.findOne({ email: identity.email });
    if (user) {
      // Google has verified this email, so it is the same person.
      user = await User.findByIdAndUpdate(
        user._id,
        {
          googleId: identity.sub,
          googleLinkedAt: new Date(),
          authProviders: Array.from(new Set([...(user.authProviders || []), "password", "google"])),
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          requiresContactVerification: false,
        },
        { new: true }
      );
    }
  }

  if (!user) {
    user = await User.create({
      fullName: identity.name || identity.email.split("@")[0],
      email: identity.email,
      // Not a usable credential: nobody knows it. The user can set a password
      // later with "Forgot password".
      password: crypto.randomBytes(32).toString("hex"),
      role,
      profileImage: identity.picture,
      googleId: identity.sub,
      googleLinkedAt: new Date(),
      authProviders: ["google"],
      emailVerifiedAt: new Date(),
      requiresContactVerification: false,
    });
  }

  if (user.role === "admin") {
    throw new AppError("Admin accounts sign in with email and password.", 403, AUTH_CODES.GOOGLE_AUTH_FAILED);
  }
  if (user.isActive === false) {
    throw new AppError("This account has been deactivated.", 403, AUTH_CODES.ACCOUNT_INACTIVE);
  }
  return user;
}

// Step 2: Google redirected back. Returns where to send the browser.
async function callback({ state, code, error }) {
  const flow = state
    ? await OAuthFlow.findOne({ stateHash: sha256(state) }).select("+codeVerifier")
    : null;
  if (!flow || flow.callbackAt || new Date(flow.expiresAt).getTime() <= Date.now()) {
    throw new AppError("This sign-in link is invalid or has expired.", 400, AUTH_CODES.OAUTH_INVALID_STATE);
  }
  await OAuthFlow.findByIdAndUpdate(flow._id, { callbackAt: new Date() });

  if (error || !code) {
    const reason = error === "access_denied" ? "cancelled" : "failed";
    await OAuthFlow.findByIdAndUpdate(flow._id, { error: reason });
    return withParams(flow.appRedirect, { googleError: reason });
  }

  try {
    const identity = await exchangeCodeForIdentity(String(code), flow);
    const user = await userForIdentity(identity, flow.role);
    const exchangeCode = randomToken();
    await OAuthFlow.findByIdAndUpdate(flow._id, {
      user: user._id,
      exchangeHash: sha256(exchangeCode),
      exchangeExpiresAt: new Date(Date.now() + EXCHANGE_TTL_MS),
    });
    return withParams(flow.appRedirect, { googleCode: exchangeCode });
  } catch (failure) {
    await OAuthFlow.findByIdAndUpdate(flow._id, { error: failure.code || "failed" });
    const reason = failure.code === AUTH_CODES.ACCOUNT_INACTIVE ? "inactive" : "failed";
    return withParams(flow.appRedirect, { googleError: reason });
  }
}

// Step 3: the app swaps the one-time code for the user (then a session).
async function redeem(exchangeCode) {
  const flow = exchangeCode ? await OAuthFlow.findOne({ exchangeHash: sha256(exchangeCode) }) : null;
  if (!flow || flow.exchangedAt || !flow.exchangeExpiresAt || new Date(flow.exchangeExpiresAt).getTime() <= Date.now()) {
    throw new AppError("This sign-in has expired. Please try again.", 400, AUTH_CODES.OAUTH_INVALID_STATE);
  }
  const claimed = await OAuthFlow.findOneAndUpdate(
    { _id: flow._id, exchangedAt: null },
    { exchangedAt: new Date() },
    { new: true }
  );
  if (!claimed) {
    throw new AppError("This sign-in has already been used.", 400, AUTH_CODES.OAUTH_INVALID_STATE);
  }
  return User.findById(flow.user);
}

module.exports = { isConfigured, start, callback, redeem, allowedAppRedirects };
