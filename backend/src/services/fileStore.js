// Storage for uploaded files. FILE_STORAGE (config/storage.js) chooses the
// driver: Cloudflare R2 (r2) or a local R2 bucket for development (local).
// Both are private: files reach clients only through /uploads/..., after
// fileAuthMiddleware has checked who may read them.
//
// Files are addressed by keys shaped "uploads/<folder>/<file>", so stored links
// ("/uploads/...", or a full URL in older rows) and Document.filePath values
// keep their meaning. MongoDB holds only these keys and file metadata; the
// bytes live in the bucket.

const { getStorageMode } = require("../config/storage");

let driver = null;
function storage() {
  if (!driver) {
    driver = getStorageMode() === "r2" ? require("./storage/r2Driver") : require("./storage/localR2Driver");
  }
  return driver;
}

// Turns a stored path or URL into a key, or null when it points outside uploads/.
function toKey(value) {
  let raw = String(value || "").trim();
  if (!raw) return null;
  const marker = raw.indexOf("/uploads/");
  if (/^https?:\/\//i.test(raw) || (marker > 0 && !raw.startsWith("uploads/"))) {
    if (marker === -1) return null;
    raw = raw.slice(marker + 1);
  }
  raw = raw.split("?")[0].replace(/\\/g, "/").replace(/^\/+/, "");
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const segments = raw.split("/");
  if (segments[0] !== "uploads" || segments.length < 3) return null;
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return segments.join("/");
}

async function save(key, data, contentType) {
  const normalized = toKey(key);
  if (!normalized) throw new Error(`Invalid storage key: ${key}`);
  if (!contentType) throw new Error(`A content type is required to store ${normalized}.`);
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await storage().put(normalized, body, contentType);
  return { key: normalized, size: body.length };
}

async function read(key) {
  const normalized = toKey(key);
  return normalized ? storage().get(normalized) : null;
}

// Bytes start..end inclusive (the caller validates the range against stat()).
async function readRange(key, start, end) {
  const normalized = toKey(key);
  return normalized ? storage().get(normalized, { start, end }) : null;
}

async function stat(key) {
  const normalized = toKey(key);
  return normalized ? storage().head(normalized) : null;
}

async function exists(key) {
  return Boolean(await stat(key));
}

async function remove(key) {
  const normalized = toKey(key);
  if (!normalized) return false;
  // Deleting a key that does not exist succeeds.
  await storage().remove(normalized);
  return true;
}

// Copies within the bucket (content type is kept), then removes the source.
async function move(fromKey, toKey_) {
  const source = toKey(fromKey);
  const target = toKey(toKey_);
  if (!source) throw new Error(`File not found: ${fromKey}`);
  if (!target) throw new Error(`Invalid storage key: ${toKey_}`);
  const info = await stat(source);
  if (!info) throw new Error(`File not found: ${fromKey}`);
  if (!info.contentType) throw new Error(`Stored file has no content type: ${fromKey}`);
  await storage().copy(source, target, info.contentType);
  await remove(source);
  return { key: target, size: info.size };
}

// Lists keys under a prefix such as "uploads/ai-prepared/".
async function list(prefix) {
  return storage().list(prefix);
}

// Confirms the bucket is reachable (health).
async function ping() {
  await storage().ping();
}

// Opens the storage at startup; returns a description for the log.
async function start() {
  return storage().start();
}

async function stop() {
  if (driver) await driver.stop();
}

// Stored links are origin-relative ("/uploads/..."). Each client (web, phone,
// admin) resolves them against the API address it is configured with, so a
// new domain never leaves stale links in the database. Older rows that hold a
// full URL keep working: clients and toKey() read the /uploads/ part.
const publicUrl = (key) => `/${key}`;

module.exports = {
  toKey,
  save,
  read,
  readRange,
  stat,
  exists,
  remove,
  move,
  list,
  ping,
  start,
  stop,
  publicUrl,
};
