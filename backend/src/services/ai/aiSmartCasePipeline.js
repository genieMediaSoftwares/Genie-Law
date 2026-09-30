const fileStore = require("../fileStore");
const { runInBackground } = require("../../utils/background");
// Sessions stay out of the database until the case is submitted.
const sessionStore = require("./tempSessionStore");
const ocrSanitizationService = require("./ocrSanitizationService");
const aiSmartIntakeService = require("./aiSmartIntakeService");
const gemini = require("./geminiClient");
const log = require("../../utils/aiLogger");
const realtimeEvents = require("../../realtime/events");
const {
  detectTranscriptLanguage,
  normaliseLanguageCode,
} = require("../../utils/transcriptLanguage");

const PIPELINE_STAGES = [
  { id: "queued", label: "Preparing your documents", weight: 2 },
  { id: "ocr", label: "Reading documents", weight: 50 },
  { id: "transcribing", label: "Transcribing voice note", weight: 12 },
  { id: "extracting", label: "Extracting case details", weight: 28 },
  { id: "classifying", label: "Classifying the legal issue", weight: 8 },
  { id: "completed", label: "Analysis complete", weight: 0 },
];

const stageIndex = (id) => PIPELINE_STAGES.findIndex((s) => s.id === id);

const weightBefore = (id) =>
  PIPELINE_STAGES.slice(0, Math.max(0, stageIndex(id))).reduce((sum, s) => sum + s.weight, 0);

const OCR_CONCURRENCY = 1;

const PIPELINE_BUDGET_MS = 8 * 60 * 1000;

const OCR_STEP_TIMEOUT_MS = 150 * 1000;
const TRANSCRIBE_STEP_TIMEOUT_MS = 120 * 1000;
const EXTRACT_STEP_TIMEOUT_MS = 180 * 1000;

const SPARSE_TEXT_THRESHOLD = 40;

const TRANSCRIPTION_PROMPT =
  "Transcribe this voice description of a legal issue verbatim.\n" +
  "Write the transcript in the language that is actually spoken — do not translate it.\n" +
  "Use that language's own script: Telugu speech in Telugu script (తెలుగు), Hindi speech in " +
  "Devanagari script (देवनागरी), English speech in Latin letters. Never romanise or " +
  "transliterate Telugu or Hindi into English letters.\n" +
  "If the speaker mixes languages, keep each phrase in the language and script it was spoken in. " +
  "Legal terms said in English — FIR, IPC, BNS, CrPC, Section 138, High Court, bail, writ, " +
  "case numbers and dates — stay in English letters exactly as spoken, inside the surrounding " +
  "Telugu or Hindi sentence.\n" +
  "Return ONLY the plain transcript, with no commentary.";

const LANGUAGE_NAMES = { en: "English", hi: "Hindi", te: "Telugu" };

function promptFor(languageCode) {
  const name = LANGUAGE_NAMES[languageCode];
  if (!name) return TRANSCRIPTION_PROMPT;
  return (
    `The speaker has told us they are speaking ${name}. Transcribe in ${name}, ` +
    `in its own script.\n${TRANSCRIPTION_PROMPT}`
  );
}

class StepTimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} exceeded ${Math.round(ms / 1000)}s`);
    this.name = "StepTimeoutError";
  }
}

function withTimeout(work, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(work).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new StepTimeoutError(label, ms)), ms);
      if (timer.unref) timer.unref();
    }),
  ]);
}

function clientSafeFailure(name, reason) {
  const text = String(reason || "");

  if (/HTTP \d{3}|ListModels|generateContent|API key|quota|rate limit|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(text)) {
    return `${name}: our document reader was unavailable, so this file was not used. Your document is saved — you can retry the analysis.`;
  }

  if (/exceeded \d+s|timed out|too long/i.test(text)) {
    return `${name}: took too long to read and was skipped. A smaller or clearer copy usually works.`;
  }

  if (/not found on disk/i.test(text)) {
    return `${name}: could not be opened after upload. Please try uploading it again.`;
  }

  if (/unsupported file type/i.test(text)) {
    return `${name}: ${text}`;
  }

  return `${name}: could not be read, so it was not used. Please upload a clearer copy if this document matters to your case.`;
}

class AiSmartCasePipeline {
  async report(session, stage, message, detail = {}) {
    const { current = null, total = null, fraction = 0 } = detail;

    const stageWeight = PIPELINE_STAGES[stageIndex(stage)]?.weight ?? 0;
    const percent = Math.min(
      100,
      Math.round(weightBefore(stage) + stageWeight * Math.min(1, Math.max(0, fraction)))
    );

    const progress = {
      stage,
      message,
      percent,
      current,
      total,
      updatedAt: new Date(),
    };

    try {
      await sessionStore.updateOne({ _id: session._id, client: session.client }, { $set: { progress } });
    } catch (e) {
      log.error("pipeline:progress-persist-failed", e, { session: session._id, stage });
    }

    this.emit(session.client, "analysis_progress", {
      sessionId: session._id.toString(),
      ...progress,
    });
  }

  emit(clientId, event, payload) {
    if (!clientId) return;
    try {
      realtimeEvents.aiAnalysis(clientId, event, payload);
    } catch (e) {
      log.error("pipeline:emit-failed", e, { event });
    }
  }

  async run({
    session,
    documentFiles,
    voiceFile,
    typedDescription,
    liveVoiceTranscript = "",
    liveVoiceLanguage = "",
  }) {
    const startedAt = Date.now();
    const overBudget = () => Date.now() - startedAt > PIPELINE_BUDGET_MS;

    let watchdogFired = false;
    const watchdog = setTimeout(() => {
      watchdogFired = true;
      log.error("pipeline:watchdog-fired", new Error("pipeline exceeded budget"), {
        session: session._id,
        elapsedMs: Date.now() - startedAt,
      });
      this._fail(
        session,
        "The analysis took longer than expected and was stopped. Please try again with fewer or smaller documents."
      ).catch((e) => log.error("pipeline:watchdog-fail-write-failed", e));
    }, PIPELINE_BUDGET_MS + 15 * 1000);
    if (watchdog.unref) watchdog.unref();

    log.info("pipeline:start", {
      session: session._id,
      documents: documentFiles.length,
      voice: Boolean(voiceFile),
    });

    try {
      await this.report(session, "queued", "Preparing your documents", { fraction: 1 });

      const { ocrText, documentMetadata, sparseFiles, failures, fraudFlags, documentSummaries } =
        await this._readDocuments(session, documentFiles, overBudget);

      let voiceTranscript = (liveVoiceTranscript || "").trim();
      let voiceTranscriptionFailed = false;
      let voiceTranscriptSource = voiceTranscript ? "live" : "none";

      let voiceTranscriptLanguage = voiceTranscript
        ? normaliseLanguageCode(liveVoiceLanguage) ||
          detectTranscriptLanguage(voiceTranscript)
        : "";

      if (voiceTranscript) {
        await this.report(session, "transcribing", "Using your voice note", { fraction: 1 });
      } else if (voiceFile) {
        if (overBudget()) {
          voiceTranscriptionFailed = true;
        } else {
          await this.report(session, "transcribing", "Transcribing your voice note", {
            fraction: 0,
          });
          const result = await this._transcribe(
            voiceFile,
            normaliseLanguageCode(liveVoiceLanguage)
          );
          voiceTranscript = result.transcript;
          voiceTranscriptionFailed = result.failed;
          if (!result.failed && result.transcript) {
            voiceTranscriptSource = "server";
            voiceTranscriptLanguage = result.language;
          }
        }
        await this.report(
          session,
          "transcribing",
          voiceTranscriptionFailed
            ? "Voice note could not be transcribed"
            : "Voice note transcribed",
          { fraction: 1 }
        );
      }

      const hasFilesToProcess = Array.isArray(documentFiles) && documentFiles.length > 0;
      const allOcrFailed = failures.length === documentFiles.length && hasFilesToProcess;

      const sources = {
        document: Boolean(ocrText.trim()) || hasFilesToProcess,
        documentText: Boolean(ocrText.trim()),
        voice: Boolean(voiceTranscript.trim()),
        notes: Boolean(typedDescription.trim()),
      };

      log.info("pipeline:sources", {
        session: session._id,
        ...sources,
        documentsFailedOcr: failures.length,
        documentsTotal: documentFiles.length,
      });

      if (!sources.document && !sources.voice && !sources.notes) {
        return this._fail(
          session,
          "There was nothing to analyse. Please upload a readable document or describe your issue."
        );
      }

      if (allOcrFailed && !sources.voice && !sources.notes) {
        log.warn("pipeline:all-ocr-failed-vision-only", {
          session: session._id,
          documents: documentFiles.length,
        });
      }

      if (overBudget()) {
        return this._fail(
          session,
          "Reading your documents took longer than expected and the analysis was stopped. Please try again with fewer or smaller files."
        );
      }

      await this.report(session, "extracting", "Extracting case details", { fraction: 0 });

      let extracted;
      let extractionNotes;
      try {
        ({ extracted, warnings: extractionNotes } = await withTimeout(
          aiSmartIntakeService.extractCaseData({
            ocrText,
            voiceTranscript,
            typedDescription,
            documentMetadata,
            documentFiles,
            priorityFiles: sparseFiles.length > 0 ? sparseFiles : documentFiles,
          }),
          EXTRACT_STEP_TIMEOUT_MS,
          "extraction"
        ));
      } catch (e) {
        log.error("pipeline:extraction-failed", e, { session: session._id });
        return this._fail(
          session,
          e instanceof StepTimeoutError
            ? "Analysing your documents took longer than expected. Please try again, or with fewer documents."
            : "We could not extract case details from your documents. Please try again, or fill the form in manually."
        );
      }

      const hasContent = extracted && (
        Boolean(extracted.title) ||
        Boolean(extracted.description) ||
        Boolean(extracted.category) ||
        Boolean(extracted.summary) ||
        (Array.isArray(extracted.parties) && extracted.parties.length > 0)
      );

      if (!hasContent && !typedDescription.trim() && !voiceTranscript.trim()) {
        return this._fail(
          session,
          "We could not extract case details from the document(s) you uploaded. Please upload a clearer copy, or describe your issue in writing, and try again."
        );
      }

      await this.report(session, "extracting", "Case details extracted", { fraction: 1 });

      await this.report(
        session,
        "classifying",
        extracted.category
          ? `Classified as ${extracted.category}${extracted.subType ? ` — ${extracted.subType}` : ""}`
          : "Could not classify the matter — you will choose a category",
        { fraction: 1 }
      );

      if (!extracted.description) {
        extracted.description = typedDescription.trim();

        if (!extracted.description) {
          const review = new Set(extracted.needsReview || []);
          review.add("description");
          extracted.needsReview = [...review];
          log.warn("pipeline:no-description-produced", {
            session: session._id,
            hasVoice: Boolean(voiceTranscript.trim()),
            hasNotes: Boolean(typedDescription.trim()),
          });
        }
      }

      for (const failure of failures) {
        log.warn("pipeline:document-unreadable", {
          session: session._id,
          name: failure.name,
          reason: failure.reason,
        });
      }

      const warnings = [
        ...failures.map((f) => clientSafeFailure(f.name, f.reason)),
        ...fraudFlags,
        ...extractionNotes,
        ...(voiceTranscriptionFailed && voiceFile
          ? ["Your voice note could not be transcribed, so it was not used."]
          : []),
      ];

      const completed = await sessionStore.findOneAndUpdate(
        { _id: session._id, client: session.client, status: "processing" },
        {
          $set: {
            status: "extracted",
            ocrExtractedText: ocrText,
            voiceTranscript,
            voiceTranscriptLanguage,
            voiceTranscriptSource,
            voiceTranscriptionFailed,
            extractedData: extracted,
            warnings,
            progress: {
              stage: "completed",
              message: "Analysis complete",
              percent: 100,
              current: null,
              total: null,
              updatedAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!completed) {
        log.warn("pipeline:completed-after-terminal", {
          session: session._id,
          watchdogFired,
        });
        return sessionStore.findOne({ _id: session._id, client: session.client });
      }

      this.emit(session.client, "analysis_complete", {
        sessionId: session._id.toString(),
        extracted,
        uploadedDocuments: completed.uploadedDocuments ?? [],
        voiceTranscript,
        voiceTranscriptLanguage,
        voiceTranscriptSource,
        voiceTranscriptionFailed,
        extractionWarnings: warnings,
        documentSummaries,
      });

      if (voiceFile && voiceTranscriptSource === "live") {
        this._verifyVoiceInBackground(session, voiceFile);
      }

      log.info("pipeline:complete", {
        session: session._id,
        elapsedMs: Date.now() - startedAt,
        category: extracted.category || "unclassified",
        warnings: warnings.length,
      });

      return completed;
    } catch (error) {
      log.error("pipeline:unhandled", error, { session: session._id });
      return this._fail(
        session,
        "We could not finish analysing your documents. Please try again, or enter your case details manually."
      );
    } finally {
      clearTimeout(watchdog);
    }
  }

  async _readDocuments(session, documentFiles, overBudget) {
    const total = documentFiles.length;

    let ocrText = "";
    const documentMetadata = [];
    const documentSummaries = [];
    const sparseFiles = [];
    const failures = [];
    const fraudFlags = [];

    let done = 0;

    for (let start = 0; start < total; start += OCR_CONCURRENCY) {
      const batch = documentFiles.slice(start, start + OCR_CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (file) => {
          if (overBudget()) {
            return {
              file,
              result: {
                extractedText: "",
                ocrQuality: "Extraction Unavailable",
                fraudFlags: [],
                charCount: 0,
                extractionFailed: true,
                extractionError: "Skipped: the analysis ran out of time.",
              },
            };
          }

          const result = await withTimeout(
            ocrSanitizationService.extractText(file.path, file.mimetype, file.originalname),
            OCR_STEP_TIMEOUT_MS,
            `ocr(${file.originalname})`
          )
            .catch((err) => {
              log.warn("pipeline:ocr-failed", {
                session: session._id,
                name: file.originalname,
                error: err.message,
              });
              return {
                extractedText: "",
                ocrQuality: "Extraction Unavailable",
                fraudFlags: [],
                charCount: 0,
                extractionFailed: true,
                extractionError:
                  err instanceof StepTimeoutError
                    ? "Reading this document took too long and it was skipped."
                    : err.message,
              };
            });

          return { file, result };
        })
      );

      for (const { file, result } of results) {
        done += 1;

        if (result.extractedText && result.extractedText.trim()) {
          ocrText += `\n\n--- DOCUMENT: ${file.originalname} ---\n${result.extractedText}`;
        }

        if (result.extractionFailed || result.charCount < SPARSE_TEXT_THRESHOLD) {
          sparseFiles.push(file);
        }

        if (result.extractionFailed) {
          failures.push({
            name: file.originalname,
            reason: result.extractionError || "OCR service unavailable",
          });
        }

        if (result.fraudFlags?.length) fraudFlags.push(...result.fraudFlags);

        documentMetadata.push({
          name: file.originalname,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.mimetype,
          ocrQuality: result.ocrQuality,
          charactersExtracted: result.charCount,
        });

        documentSummaries.push({
          name: file.originalname,
          ocrQuality: result.ocrQuality,
          charactersExtracted: result.charCount,
          failed: Boolean(result.extractionFailed),
        });

        await this.report(
          session,
          "ocr",
          total === 1
            ? `Read ${file.originalname}`
            : `Read document ${done} of ${total} — ${file.originalname}`,
          { current: done, total, fraction: done / total }
        );
      }
    }

    if (documentSummaries.length > 0) {
      try {
        await sessionStore.updateOne(
          { _id: session._id, client: session.client },
          {
            $set: documentSummaries.reduce((patch, summary, i) => {
              patch[`uploadedDocuments.${i}.ocrQuality`] = summary.ocrQuality;
              return patch;
            }, {}),
          }
        );
      } catch (e) {
        log.warn("pipeline:ocr-quality-persist-failed", {
          session: session._id,
          error: e.message,
        });
      }
    }

    return { ocrText, documentMetadata, sparseFiles, failures, fraudFlags, documentSummaries };
  }

  // Exposed as pendingVoiceVerification so the caller can clean up the voice
  // file only after it has been read.
  _verifyVoiceInBackground(session, voiceFile) {
    this.pendingVoiceVerification = runInBackground("smart-case:voice-verification", async () => {
      try {
        const { transcript, failed } = await this._transcribe(voiceFile);
        if (failed || !transcript) return;

        await sessionStore.updateOne(
          { _id: session._id, client: session.client },
          { $set: { serverVoiceTranscript: transcript } }
        );
      } catch (err) {
        log.warn("pipeline:background-voice-verification-failed", { error: err.message });
      }
    });
  }

  async _transcribe(voiceFile, languageCode = "") {
    try {
      const audio = voiceFile.path ? await fileStore.read(voiceFile.path) : null;
      if (!audio) {
        log.warn("pipeline:voice-missing", { path: voiceFile.path });
        return { transcript: "", failed: true };
      }

      const audioBase64 = audio.toString("base64");

      const { text } = await withTimeout(
        gemini.generate(
          [
            {
              inlineData: {
                mimeType: voiceFile.mimetype || "audio/mp4",
                data: audioBase64,
              },
            },
            { text: promptFor(languageCode) },
          ],
          { label: "smart-case:transcribe" }
        ),
        TRANSCRIBE_STEP_TIMEOUT_MS,
        "transcription"
      );

      const transcript = text || "";
      return {
        transcript,
        language: detectTranscriptLanguage(transcript),
        failed: !text,
      };
    } catch (err) {
      log.warn("pipeline:transcription-failed", { error: err.message });
      return { transcript: "", language: "", failed: true };
    }
  }

  async _fail(session, reason) {
    try {
      const failed = await sessionStore.findOneAndUpdate(
        { _id: session._id, client: session.client, status: "processing" },
        {
          $set: {
            status: "failed",
            failureReason: reason,
            progress: {
              stage: "failed",
              message: reason,
              percent: 100,
              current: null,
              total: null,
              updatedAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!failed) {
        log.warn("pipeline:fail-after-terminal", { session: session._id, reason });
        return sessionStore.findOne({ _id: session._id, client: session.client });
      }

      log.warn("pipeline:failed", { session: session._id, reason });

      this.emit(session.client, "analysis_failed", {
        sessionId: session._id.toString(),
        message: reason,
      });

      return failed;
    } catch (e) {
      log.error("pipeline:fail-write-failed", e, { session: session._id });
      this.emit(session.client, "analysis_failed", {
        sessionId: session._id.toString(),
        message: reason,
      });
      return null;
    }
  }
}

module.exports = {
  AiSmartCasePipeline,
  PIPELINE_STAGES,
  PIPELINE_BUDGET_MS,
  StepTimeoutError,
};
