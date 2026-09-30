const path = require("path");

const RESERVED_STEMS = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

// eslint-disable-next-line no-control-regex
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;

const MAX_NAME_LENGTH = 120;

const displayName = (document) => {
  const chosen = (document?.name || "").trim();
  return chosen || (document?.originalName || "").trim() || "document";
};

const storedExtension = (document) => {
  const fromStored = path.extname(document?.fileName || "");
  if (fromStored) return fromStored.toLowerCase();
  return path.extname(document?.originalName || "").toLowerCase();
};

const sanitiseDisplayName = (rawInput, document) => {
  if (typeof rawInput !== "string") {
    return { ok: false, reason: "A document name is required." };
  }

  const extension = storedExtension(document);

  let candidate = rawInput
    .replace(ILLEGAL, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();

  if (!candidate) {
    return { ok: false, reason: "A document name is required." };
  }

  if (extension) {
    while (candidate.toLowerCase().endsWith(extension)) {
      const stripped = candidate.slice(0, -extension.length).trim();
      if (!stripped) break;
      candidate = stripped;
    }
  }

  if (!candidate || candidate.toLowerCase() === extension) {
    return { ok: false, reason: "A document name is required." };
  }

  if (RESERVED_STEMS.has(candidate.toLowerCase())) {
    candidate = `${candidate}_file`;
  }

  if (candidate.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      reason: `A document name may be at most ${MAX_NAME_LENGTH} characters.`,
    };
  }

  return { ok: true, name: `${candidate}${extension}` };
};

const contentDisposition = (type, name) => {
  const safeName = String(name || "document");

  const ascii =
    safeName
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || "document";

  const encoded = encodeURIComponent(safeName);

  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

module.exports = {
  displayName,
  storedExtension,
  sanitiseDisplayName,
  contentDisposition,
  MAX_NAME_LENGTH,
};
