// Centralised AI configuration for the Genie Law backend.
// Every timeout, model preference and threshold lives here.
// Change these values without touching the service code.

const { required, requiredNumber } = require("./env");

// ── Model selection ────────────────────────────────────────────────────────
// Ordered most-preferred first. The geminiClient tries each in turn and
// falls back on 404 / 503 / 429.  Never invent IDs — verify each one on
// https://ai.google.dev/gemini-api/docs/models
module.exports.PRIMARY_MODEL = required("GEMINI_MODEL_PRIMARY");
module.exports.FALLBACK_MODEL = required("GEMINI_MODEL_FALLBACK");

// ── Timeouts (ms) ──────────────────────────────────────────────────────────
// Tuned per operation.  Do NOT set every timeout to the same value —
// extraction legitimately needs more time than a quick relevance check.

module.exports.TIMEOUTS = {
  // Single document relevance classification (one Gemini call).
  relevance: requiredNumber("AI_RELEVANCE_TIMEOUT_MS"),

  // Full smart-case extraction (one Gemini call with multiple parts).
  extraction: requiredNumber("AI_EXTRACTION_TIMEOUT_MS"),

  // Voice transcription via Gemini.
  transcription: requiredNumber("AI_TRANSCRIPTION_TIMEOUT_MS"),

  // OCR for a single document (PDF→text or image→text).
  ocr: requiredNumber("AI_OCR_TIMEOUT_MS"),

  // Legal research (may include Google Search grounding).
  research: requiredNumber("AI_RESEARCH_TIMEOUT_MS"),

  // General chat (fast, streaming-eligible).
  chat: requiredNumber("AI_CHAT_TIMEOUT_MS"),

  // PDF optimization on the server (no AI, pure CPU).
  pdfOptimize: requiredNumber("AI_PDF_OPTIMIZE_TIMEOUT_MS"),
};

// ── Relevance classifier ───────────────────────────────────────────────────
module.exports.RELEVANCE_THRESHOLD = requiredNumber("AI_RELEVANCE_THRESHOLD");
module.exports.RELEVANCE_MAX_TEXT_CHARS = 30_000;

// ── Extraction budget ──────────────────────────────────────────────────────
module.exports.INLINE_BUDGET_BYTES = 14 * 1024 * 1024; // 14 MB base64 budget
module.exports.INLINE_MAX_FILES = 6;
module.exports.MAX_CONTEXT_CHARS = 150_000;
module.exports.MAX_CHARS_PER_DOCUMENT = 40_000;
module.exports.MAX_DOCUMENTS = 10;

// ── Legal research ─────────────────────────────────────────────────────────
// (LEGAL_SEARCH_PROVIDER is read by services/ai/legalResearchService.)
module.exports.MAX_RELEVANT_CASES = 6;
module.exports.MAX_FOLLOW_UP_MESSAGES = 20;

// ── Retry / back-off ───────────────────────────────────────────────────────
module.exports.RETRY = {
  // How many full model-list passes before giving up.
  maxPasses: 2,
  // Pause between passes.
  passDelayMs: 3000,
};

// ── Model health ───────────────────────────────────────────────────────────
// A model that times out or answers 429/5xx is skipped for a while, so
// requests go straight to the model that is working instead of waiting on an
// overloaded one first. Each repeated failure doubles the pause.
module.exports.MODEL_HEALTH = {
  cooldownMs: 60 * 1000,
  maxCooldownMs: 10 * 60 * 1000,
  // After its pause, a model gets one short trial instead of the full timeout.
  probeTimeoutMs: 15 * 1000,
};

// ── Pipeline ───────────────────────────────────────────────────────────────
module.exports.PIPELINE = {
  budgetMs: 8 * 60 * 1000, // 8-minute wall-clock budget
  ocrConcurrency: 1, // one document at a time (OCR is GPU-heavy)
  staleGraceMs: 60 * 1000,
  maxConcurrentSessionsPerClient: 3,
};
