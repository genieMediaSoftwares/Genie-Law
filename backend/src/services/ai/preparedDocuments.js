const crypto = require("crypto");
const path = require("path");
const fileStore = require("../fileStore");

// An optimized document waits here until the case that uses it is submitted.
const PREPARED_PREFIX = "uploads/ai-prepared";
const CASES_PREFIX = "uploads/cases";
// Long enough to finish filling in the case after the analysis.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Where prepared files live when there is no R2 bucket (plain Node tests).
const PREPARED_DIR = path.resolve(
  typeof __dirname !== "undefined" ? __dirname : ".",
  "../../..",
  PREPARED_PREFIX
);

const TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const OWNER_PATTERN = /^[a-f0-9]{24}$/;

const keysFor = (ownerId, token) => {
  const base = `${PREPARED_PREFIX}/${ownerId}-${token}`;
  return { file: `${base}.pdf`, meta: `${base}.json` };
};

async function save(ownerId, data, { originalName, mimeType }) {
  const owner = String(ownerId);
  if (!OWNER_PATTERN.test(owner)) throw new Error("Invalid owner.");
  if (!Buffer.isBuffer(data)) throw new Error("A prepared document must be a Buffer.");

  const token = crypto.randomBytes(16).toString("hex");
  const { file, meta } = keysFor(owner, token);

  await fileStore.save(file, data, mimeType || "application/pdf");
  await fileStore.save(
    meta,
    Buffer.from(JSON.stringify({ originalName, mimeType, size: data.length, createdAt: Date.now() })),
    "application/json"
  );

  return { token, size: data.length };
}

/**
 * Finds a live prepared document. Returns null when the token is unknown,
 * expired, or belongs to someone else.
 */
async function lookup(ownerId, token) {
  const owner = String(ownerId);
  const value = String(token ?? "");
  if (!OWNER_PATTERN.test(owner) || !TOKEN_PATTERN.test(value)) return null;

  const { file, meta } = keysFor(owner, value);
  let details;
  try {
    const raw = await fileStore.read(meta);
    if (!raw || !(await fileStore.exists(file))) return null;
    details = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }

  if (Date.now() - Number(details.createdAt || 0) > MAX_AGE_MS) {
    await Promise.all([file, meta].map((key) => fileStore.remove(key).catch(() => {})));
    return null;
  }
  return { file, meta, details };
}

/**
 * Lends a prepared document to an analysis without consuming it, in the shape
 * the upload middleware gives uploaded files (`path` is the file-store key).
 * It stays prepared so the same token can be submitted with the case.
 */
async function peek(ownerId, token) {
  const found = await lookup(ownerId, token);
  if (!found) return null;
  const { file, details } = found;
  return {
    path: file,
    filename: file.split("/").pop(),
    originalname: details.originalName || "document.pdf",
    mimetype: details.mimeType || "application/pdf",
    size: Number(details.size) || 0,
    prepared: true,
  };
}

/**
 * Moves a prepared document into permanent case storage (on case submission).
 * Returns the stored file in upload-middleware shape, or null as lookup().
 */
async function claim(ownerId, token) {
  const found = await lookup(ownerId, token);
  if (!found) return null;
  const { file, meta, details } = found;

  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.pdf`;
  const destination = `${CASES_PREFIX}/${fileName}`;
  const moved = await fileStore.move(file, destination);
  await fileStore.remove(meta).catch(() => {});

  return {
    path: destination,
    filename: fileName,
    originalname: details.originalName || "document.pdf",
    mimetype: details.mimeType || "application/pdf",
    size: moved.size,
  };
}

async function sweep(now = Date.now()) {
  let removed = 0;
  for (const entry of await fileStore.list(`${PREPARED_PREFIX}/`)) {
    const uploadedAt = entry.uploadedAt ? new Date(entry.uploadedAt).getTime() : 0;
    if (now - uploadedAt > MAX_AGE_MS && (await fileStore.remove(entry.key))) removed += 1;
  }
  return removed;
}

module.exports = { save, peek, claim, sweep, PREPARED_DIR, PREPARED_PREFIX, MAX_AGE_MS };
