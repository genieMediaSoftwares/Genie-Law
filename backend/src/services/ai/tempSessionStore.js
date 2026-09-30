// Temporary storage for AI Smart Case sessions while a case is being drafted.
//
// Everything the assistant produces before "Submit Case" — progress, the text
// read from documents, the extracted fields, summary, category, warnings,
// transcripts — lives here, NOT in the database. Each session is one JSON
// object in the file store (R2) at uploads/ai-sessions/<client>/<id>.json and
// is deleted when its case is submitted, or swept after MAX_AGE_MS.
// Only caseSubmissionService copies a session into the database (the
// AiSmartCaseSession table), as part of submitting the case it drafted.
//
// The methods mirror the small part of the model API the pipeline uses, so
// its code reads the same. Every filter must name the owning `client`.

const fileStore = require("../fileStore");
const { generateId } = require("../../models/ids");

const PREFIX = "uploads/ai-sessions";
// Long enough to finish the case form after the analysis.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const keyFor = (client, id) => {
  const owner = String(client || "");
  const sessionId = String(id || "");
  if (!ID_PATTERN.test(owner) || !ID_PATTERN.test(sessionId)) return null;
  return `${PREFIX}/${owner}/${sessionId}.json`;
};

const requireClient = (filter) => {
  if (!filter || !filter.client) throw new Error("tempSessionStore: filters must include `client`.");
};

async function read(client, id) {
  const key = keyFor(client, id);
  if (!key) return null;
  const raw = await fileStore.read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

async function write(session) {
  session.updatedAt = new Date().toISOString();
  await fileStore.save(keyFor(session.client, session._id), Buffer.from(JSON.stringify(session)), "application/json");
  return session;
}

// Equality on top-level fields (ids compared as strings).
const matches = (session, filter) =>
  Object.entries(filter).every(([field, value]) => String(session[field]) === String(value));

// Applies a { $set: { "a.b.0.c": value } } update in place.
function applySet(session, update) {
  for (const [path, value] of Object.entries((update && update.$set) || {})) {
    const parts = path.split(".");
    let target = session;
    for (const part of parts.slice(0, -1)) {
      if (target[part] === undefined || target[part] === null) target[part] = {};
      target = target[part];
    }
    target[parts[parts.length - 1]] = value instanceof Date ? value.toISOString() : value;
  }
  return session;
}

async function listForClient(client) {
  const owner = String(client || "");
  if (!ID_PATTERN.test(owner)) return [];
  const sessions = [];
  for (const entry of await fileStore.list(`${PREFIX}/${owner}/`)) {
    const id = entry.key.split("/").pop().replace(/\.json$/, "");
    const session = await read(owner, id);
    if (session) sessions.push(session);
  }
  return sessions;
}

const tempSessionStore = {
  async create(data) {
    const now = new Date().toISOString();
    const session = JSON.parse(JSON.stringify({ ...data, _id: generateId(), createdAt: now }));
    session.client = String(data.client);
    return write(session);
  },

  async findOne(filter) {
    requireClient(filter);
    if (filter._id) {
      const session = await read(filter.client, filter._id);
      return session && matches(session, filter) ? session : null;
    }
    return (await listForClient(filter.client)).find((session) => matches(session, filter)) || null;
  },

  async find(filter) {
    requireClient(filter);
    return (await listForClient(filter.client)).filter((session) => matches(session, filter));
  },

  async countDocuments(filter) {
    requireClient(filter);
    return (await listForClient(filter.client)).filter((session) => matches(session, filter)).length;
  },

  async updateOne(filter, update) {
    const session = await this.findOne(filter);
    if (!session) return { modifiedCount: 0 };
    await write(applySet(session, update));
    return { modifiedCount: 1 };
  },

  // Returns the updated session, or null when none matched the filter.
  async findOneAndUpdate(filter, update) {
    const session = await this.findOne(filter);
    return session ? write(applySet(session, update)) : null;
  },

  async remove(client, id) {
    const key = keyFor(client, id);
    if (key) await fileStore.remove(key);
  },

  // Every session of every client, for maintenance.
  async listAll() {
    const sessions = [];
    for (const entry of await fileStore.list(`${PREFIX}/`)) {
      const [, , owner, file] = entry.key.split("/");
      const session = owner && file ? await read(owner, file.replace(/\.json$/, "")) : null;
      if (session) sessions.push(session);
    }
    return sessions;
  },

  // Deletes sessions whose case was never submitted.
  async sweep(now = Date.now()) {
    let removed = 0;
    for (const entry of await fileStore.list(`${PREFIX}/`)) {
      const updatedAt = entry.uploadedAt ? new Date(entry.uploadedAt).getTime() : 0;
      if (now - updatedAt > MAX_AGE_MS && (await fileStore.remove(entry.key))) removed += 1;
    }
    return removed;
  },
};

module.exports = tempSessionStore;
module.exports.MAX_AGE_MS = MAX_AGE_MS;
