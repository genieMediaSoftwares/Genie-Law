// Shared Gemini HTTP client.
//
// Centralises:
//   - Model list (primary + fallback, configurable via env)
//   - Per-call timeouts via AbortController
//   - Pausing models that are overloaded or failing, so requests use the
//     working model first (see "Model health")
//   - Another pass over the models when every one failed
//   - Distinguishing transient (429, 500, 503, network) from permanent (400, 401, 403, 404) failures
//   - Bounded concurrency so one slow request doesn't block another
//
// All callers go through `generate()` or `generateWithSearch()`. Do not call
// the Gemini endpoint directly anywhere else.

const aiConfig = require("../../config/ai");
const { optional } = require("../../config/env");
const log = require("../../utils/aiLogger");

// ── Model list ─────────────────────────────────────────────────────────────
// Primary + fallback, ordered. Add additional fallbacks by appending. Each
// value is read from env at module load time. If the user sets an invalid
// model ID in env, we report it once at runtime and skip it.
function buildModelList() {
  const list = [];
  if (aiConfig.PRIMARY_MODEL) list.push(aiConfig.PRIMARY_MODEL);
  if (aiConfig.FALLBACK_MODEL && aiConfig.FALLBACK_MODEL !== aiConfig.PRIMARY_MODEL) {
    list.push(aiConfig.FALLBACK_MODEL);
  }
  return list;
}

const MODEL_LIST = buildModelList();

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// ── Concurrency limiter ────────────────────────────────────────────────────
// A simple per-process semaphore. Prevents a flood of concurrent Gemini
// requests from blowing past rate limits.
class Semaphore {
  constructor(max) {
    this.max = Math.max(1, max);
    this.active = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.active = Math.max(0, this.active - 1);
    }
  }
  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// Cap concurrent Gemini requests per process. 6 is generous for free tier
// and avoids 429s under bursty load.
const geminiSemaphore = new Semaphore(6);

// ── Failure classification ────────────────────────────────────────────────
function isTransient(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 ||
    status === 503 || status === 504;
}

function isPermanent(status) {
  return status === 400 || status === 401 || status === 403 || status === 404 ||
    status === 422;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Model health ───────────────────────────────────────────────────────────
// When a model is overloaded (Gemini answers 503 "high demand", sometimes only
// after a minute or more), every request that tries it first waits that long
// before reaching the fallback. So a model that times out or answers 429/5xx
// is paused (aiConfig.MODEL_HEALTH) and requests use the other model first.
// A paused model is still tried as a last resort, and after its pause it gets
// one short trial; a success clears its record.
const modelHealth = new Map(); // model -> { failures, until }

function recordFailure(model, reason) {
  const { cooldownMs, maxCooldownMs } = aiConfig.MODEL_HEALTH;
  const failures = (modelHealth.get(model)?.failures || 0) + 1;
  const pauseMs = Math.min(cooldownMs * 2 ** (failures - 1), maxCooldownMs);
  modelHealth.set(model, { failures, until: Date.now() + pauseMs });
  log.warn("gemini:model-paused", { model, reason, pauseMs });
}

function recordSuccess(model) {
  if (modelHealth.delete(model)) log.info("gemini:model-recovered", { model });
}

const isPaused = (model) => (modelHealth.get(model)?.until || 0) > Date.now();

// Models in the order to try now: working ones in configured order, then
// paused ones (the one whose pause ends first leads).
function modelsToTry() {
  const ready = MODEL_LIST.filter((model) => !isPaused(model));
  const paused = MODEL_LIST.filter(isPaused).sort(
    (a, b) => modelHealth.get(a).until - modelHealth.get(b).until
  );
  return [...ready, ...paused];
}

// A model coming back from a pause gets a short trial, not the full timeout.
function timeoutFor(model, timeoutMs) {
  return modelHealth.has(model) ? Math.min(timeoutMs, aiConfig.MODEL_HEALTH.probeTimeoutMs) : timeoutMs;
}

// ── The client ─────────────────────────────────────────────────────────────
class GeminiClient {
  get apiKey() {
    return optional("GEMINI_API_KEY");
  }
  get isConfigured() {
    return Boolean(this.apiKey);
  }
  get modelList() {
    return MODEL_LIST.slice();
  }

  /**
   * One Gemini call.
   * @param {Array} parts - Gemini content parts.
   * @param {Object} options
   * @param {string} [options.label] - identifier for logs.
   * @param {number} [options.timeoutMs] - per-model timeout.
   * @param {number} [options.passes] - how many full model-list passes.
   * @param {Object} [options.generationConfig]
   * @param {string|null} [options.systemInstruction]
   * @param {Array} [options.contents] - a whole multi-turn conversation
   *   ([{ role, parts }]); when given, `parts` is ignored.
   * @returns {Promise<{text: string|null, model: string|null, error: string|null, fatal: boolean}>}
   */
  async generate(parts, options = {}) {
    const {
      label = "gemini",
      timeoutMs = aiConfig.TIMEOUTS.chat,
      passes = aiConfig.RETRY.maxPasses,
      generationConfig = null,
      systemInstruction = null,
      contents = null,
    } = options;
    const requestContents = contents || [{ role: "user", parts }];

    if (!this.isConfigured) {
      return { text: null, model: null, error: "GEMINI_API_KEY is not configured.", fatal: true };
    }
    if (MODEL_LIST.length === 0) {
      return { text: null, model: null, error: "No Gemini models configured.", fatal: true };
    }

    let lastError = null;

    for (let pass = 0; pass < passes; pass += 1) {
      if (pass > 0) {
        log.warn(`gemini:${label}:pass-retry`, { pass, delayMs: aiConfig.RETRY.passDelayMs });
        await sleep(aiConfig.RETRY.passDelayMs);
      }

      const result = await this._attemptPass(requestContents, timeoutMs, label, generationConfig, systemInstruction);
      if (result.text !== null) return result;
      if (result.fatal) return { text: null, model: null, error: result.error, fatal: true };

      lastError = result.error;
    }

    log.error(`gemini:${label}:exhausted`, { lastError, passes });
    return { text: null, model: null, error: lastError, fatal: false };
  }

  async _attemptPass(contents, timeoutMs, label, generationConfig, systemInstruction) {
    let lastError = null;

    for (const model of modelsToTry()) {
      const result = await this._callModel(model, contents, timeoutFor(model, timeoutMs), label, generationConfig, systemInstruction);
      if (result.text !== null) {
        return { text: result.text, model, error: null };
      }
      lastError = result.error;

      // Permanent errors are not worth retrying on another model.
      if (result.fatal) {
        return { text: null, model: null, error: lastError, fatal: true };
      }
      log.warn(`gemini:${label}:model-fail`, { model, error: lastError });
    }

    return { text: null, model: null, error: lastError, fatal: false };
  }

  // One request to one model. A failing model is not retried here: the next
  // model is tried at once, and generate() makes another pass if all fail.
  async _callModel(model, contents, timeoutMs, label, generationConfig, systemInstruction) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await geminiSemaphore.run(() =>
        fetch(ENDPOINT(model), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            contents,
            ...(generationConfig ? { generationConfig } : {}),
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
          }),
          signal: controller.signal,
        })
      );

      if (response.ok) {
        const data = await response.json();
        recordSuccess(model);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return { text: text.trim(), error: null };
        }
        // Empty response (safety block or no content): try the next model.
        log.warn(`gemini:${label}:empty`, { model });
        return { text: null, error: `${model}: empty response (possible safety block or no content)`, fatal: false };
      }

      const body = await response.text();
      const error = `${model}: HTTP ${response.status} ${body.slice(0, 200)}`;

      if (isPermanent(response.status)) {
        log.error(`gemini:${label}:permanent`, { model, status: response.status, body: body.slice(0, 200) });
        // 401/403 are account-wide: stop. 404 means the model id is retired:
        // pause it for the longest time. 400/422 are about this request: try
        // the next model, which may accept it.
        if (response.status === 401 || response.status === 403) {
          return { text: null, error, fatal: true };
        }
        if (response.status === 404) recordFailure(model, "HTTP 404 (unknown model id)");
        return { text: null, error, fatal: false };
      }

      if (isTransient(response.status)) recordFailure(model, `HTTP ${response.status}`);
      return { text: null, error, fatal: false };
    } catch (err) {
      const error = err.name === "AbortError" ? `${model}: timed out after ${timeoutMs}ms` : `${model}: ${err.message}`;
      recordFailure(model, err.name === "AbortError" ? "timeout" : "network error");
      log.warn(`gemini:${label}:exception`, { model, error });
      return { text: null, error, fatal: false };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Same as generate() but enables Google Search grounding. */
  async generateWithSearch(prompt, options = {}) {
    const { label = "gemini-search", systemInstruction = null } = options;
    const timeoutMs = aiConfig.TIMEOUTS.research;
    if (!this.isConfigured) {
      return { text: null, sources: [], supports: [], error: "GEMINI_API_KEY is not configured.", fatal: true };
    }

    let lastError = null;
    for (const model of modelsToTry()) {
      const modelTimeoutMs = timeoutFor(model, timeoutMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), modelTimeoutMs);
      try {
        const response = await geminiSemaphore.run(() =>
          fetch(ENDPOINT(model), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": this.apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              tools: [{ google_search: {} }],
              ...(systemInstruction
                ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
                : {}),
            }),
            signal: controller.signal,
          })
        );

        if (!response.ok) {
          lastError = `${model}: HTTP ${response.status}`;
          if (isTransient(response.status) || response.status === 404) {
            recordFailure(model, `HTTP ${response.status}`);
            continue;
          }
          return { text: null, sources: [], supports: [], error: lastError, fatal: false };
        }

        const data = await response.json();
        recordSuccess(model);
        const candidate = data?.candidates?.[0];
        const text = (candidate?.content?.parts || []).map((p) => p.text || "").join("").trim();
        const grounding = candidate?.groundingMetadata || {};
        const sources = (grounding.groundingChunks || [])
          .map((chunk) => chunk.web)
          .filter((web) => web && web.uri)
          .map((web) => ({ uri: web.uri, title: web.title || "" }));
        const supports = (grounding.groundingSupports || []).map((support) => ({
          text: support.segment?.text || "",
          sourceIndices: support.groundingChunkIndices || [],
        }));

        if (!text) {
          lastError = `${model}: empty response`;
          continue;
        }
        return { text, sources, supports, model, error: null };
      } catch (err) {
        lastError = err.name === "AbortError" ? `${model}: timed out` : `${model}: ${err.message}`;
        recordFailure(model, err.name === "AbortError" ? "timeout" : "network error");
      } finally {
        clearTimeout(timer);
      }
    }
    return { text: null, sources: [], supports: [], error: lastError, fatal: false };
  }

  /** No-op used by integration tests / health checks. */
  async ping() {
    return this.generate([{ text: "Reply with the single word OK." }], {
      label: "ping",
      timeoutMs: 10_000,
      passes: 1,
    });
  }
}

module.exports = new GeminiClient();
module.exports.MODEL_LIST = MODEL_LIST;
module.exports.Semaphore = Semaphore;
