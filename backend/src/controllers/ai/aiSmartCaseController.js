const path = require("path");
const ApiResponse = require("../../config/ApiResponse");
// Submitted sessions (saved with their case); read-only here.
const AiSmartCaseSession = require("../../models/AiSmartCaseSession");
// Sessions being drafted: temporary, never in the database before submission.
const tempSessions = require("../../services/ai/tempSessionStore");
const {
  AiSmartCasePipeline,
  PIPELINE_BUDGET_MS,
} = require("../../services/ai/aiSmartCasePipeline");
const log = require("../../utils/aiLogger");
const pdfOptimizer = require("../../services/document/pdfOptimizer");
const preparedDocuments = require("../../services/ai/preparedDocuments");
const fileStore = require("../../services/fileStore");
const tempFiles = require("../../services/ai/tempFiles");
const documentRelevance = require("../../services/ai/documentRelevanceService");
const { validateUpload, SubmissionError } = require("../../services/case/caseSubmissionService");
const { runInBackground } = require("../../utils/background");
const {
  AI_MAX_FILE_BYTES,
  AI_MAX_FILE_LABEL,
  AI_MAX_DOCUMENTS,
} = require("../../config/uploadLimits");
const {
  detectTranscriptLanguage,
  normaliseLanguageCode,
} = require("../../utils/transcriptLanguage");

const MAX_LIVE_TRANSCRIPT_CHARS = 20000;

const MAX_CONCURRENT_SESSIONS_PER_CLIENT = 3;

const STALE_GRACE_MS = 60 * 1000;

const OPTIMIZATION_STATUS = {
  UNAVAILABLE: 503,
  INVALID_PDF: 415,
  FAILED: 422,
  STILL_TOO_LARGE: 422,
};

const isPdf = (file) =>
  file.mimetype === "application/pdf" ||
  path.extname(file.originalname || "").toLowerCase() === ".pdf";

class AiSmartCaseController {
  // Shrinks a PDF over the AI limit and holds the result for the next analysis.
  async optimizeDocument(req, res, next) {
    const file = req.file;
    try {
      const clientId = req.user?._id;
      if (!file) {
        return ApiResponse.error(res, "Choose a PDF to optimize.", 400);
      }
      if (!isPdf(file)) {
        await removeUploadedFiles([file]);
        return ApiResponse.error(
          res,
          "Only PDFs are optimized on the server. Images are compressed in the app, and DOCX and text files are never altered.",
          415
        );
      }

      let result;
      try {
        const input = await fileStore.read(file.path);
        if (!input) {
          return ApiResponse.error(res, "The uploaded PDF could not be read. Please add it again.", 400);
        }
        result = await pdfOptimizer.optimizePdfBuffer(input, { targetBytes: AI_MAX_FILE_BYTES });
      } catch (error) {
        await removeUploadedFiles([file]);
        if (error instanceof pdfOptimizer.PdfOptimizationError) {
          log.warn("optimize:rejected", { code: error.code, size: file.size });
          return ApiResponse.error(res, error.message, OPTIMIZATION_STATUS[error.code] || 422);
        }
        throw error;
      }

      const prepared = await preparedDocuments.save(clientId, result.buffer, {
        originalName: file.originalname,
        mimeType: "application/pdf",
      });
      await removeUploadedFiles([file]);
      runInBackground("prepared-documents:sweep", () => preparedDocuments.sweep());

      log.info("optimize:done", {
        client: clientId,
        originalSize: result.originalSize,
        size: prepared.size,
        passes: result.passes,
      });

      return ApiResponse.success(
        res,
        result.optimized ? "PDF optimized." : "PDF is already within the limit.",
        {
          token: prepared.token,
          name: file.originalname,
          mimeType: "application/pdf",
          size: prepared.size,
          originalSize: result.originalSize,
          optimized: result.optimized,
        },
        201
      );
    } catch (error) {
      if (file) await removeUploadedFiles([file]);
      return next(error);
    }
  }

  // POST /ai/documents/relevance — is this document part of the client's case?
  // multipart: `document` (one file, held in memory and never stored) or
  // `preparedToken` (a PDF optimized earlier), plus case-context fields.
  // Nothing is written to storage or the database.
  async checkDocumentRelevance(req, res, next) {
    try {
      let file = req.file;
      const token = typeof req.body?.preparedToken === "string" ? req.body.preparedToken : "";
      if (!file && token) {
        const prepared = await preparedDocuments.peek(req.user._id, token);
        const buffer = prepared ? await fileStore.read(prepared.path) : null;
        if (!buffer) {
          return ApiResponse.error(res, "An optimized document has expired. Please remove it and add it again.", 410);
        }
        file = { originalname: prepared.originalname, mimetype: prepared.mimetype, buffer };
      }
      if (!file) {
        return ApiResponse.error(res, "Choose a document to check.", 400);
      }

      // File type, size and content are checked before any AI call.
      let upload;
      try {
        upload = validateUpload(file);
      } catch (error) {
        if (error instanceof SubmissionError) return ApiResponse.error(res, error.message, error.statusCode);
        throw error;
      }

      const body = req.body || {};
      const context = {
        category: body.category,
        subcategory: body.subcategory,
        title: body.title,
        description: body.description,
        summary: body.summary,
        notes: body.notes,
        voiceTranscript: body.voiceTranscript,
        acceptedDocumentTypes: body.acceptedDocumentTypes,
      };

      try {
        const result = await documentRelevance.checkRelevance({
          buffer: upload.buffer,
          ext: upload.ext,
          mimeType: upload.mimeType,
          name: upload.name,
          context,
        });
        log.info("relevance:checked", {
          client: req.user._id,
          accepted: result.accepted,
          confidence: result.confidence,
          documentType: result.documentType,
        });
        return ApiResponse.success(
          res,
          result.accepted ? "Document verified." : "Document not relevant.",
          {
            name: upload.name,
            ...result,
            verificationToken: result.accepted
              ? documentRelevance.verificationTokenFor(req.user._id, upload.buffer)
              : null,
          }
        );
      } catch (error) {
        if (error instanceof documentRelevance.VerificationError) {
          return res.status(503).json({
            success: false,
            code: "VERIFICATION_FAILED",
            message: "Document verification failed. Please try again.",
          });
        }
        throw error;
      }
    } catch (error) {
      return next(error);
    }
  }

  async analyzeSmartCase(req, res, next) {
    let documentFiles = [];
    let voiceFile = null;

    try {
      const clientId = req.user?._id;
      if (!clientId) {
        return ApiResponse.error(res, "You must be signed in to use the AI assistant.", 401);
      }

      documentFiles =
        req.files?.documents || (Array.isArray(req.files) ? req.files : []);
      voiceFile = req.files?.voice ? req.files.voice[0] : req.file || null;

      const requestId = String(
        req.get("X-Request-Id") || req.body?.requestId || ""
      )
        .trim()
        .slice(0, 128);

      if (requestId) {
        const existing = await tempSessions.findOne({
          client: clientId,
          requestId,
        });

        if (existing) {
          log.info("analyze:idempotent-replay", {
            session: existing._id,
            requestId,
          });
          await removeUploadedFiles([...documentFiles, voiceFile]);

          return ApiResponse.success(res, "Analysis already started.", {
            sessionId: existing._id.toString(),
            status: existing.status,
            progress: existing.progress,
            uploadedDocuments: existing.uploadedDocuments,
            documentCount: existing.uploadedDocuments.length,
          }, 202);
        }
      }

      const oversized = (documentFiles || []).find((f) => f.size > AI_MAX_FILE_BYTES);
      if (oversized) {
        await removeUploadedFiles([...documentFiles, voiceFile]);
        return ApiResponse.error(
          res,
          `${oversized.originalname} is larger than ${AI_MAX_FILE_LABEL}. Please add it again so it can be optimized before upload.`,
          413
        );
      }

      const tokens = [].concat(req.body?.preparedDocuments || []).map(String);
      if (documentFiles.length + tokens.length > AI_MAX_DOCUMENTS) {
        await removeUploadedFiles([...documentFiles, voiceFile]);
        return ApiResponse.error(res, `You can attach up to ${AI_MAX_DOCUMENTS} documents.`, 400);
      }

      if (documentFiles.length + tokens.length === 0) {
        await removeUploadedFiles([voiceFile]);
        return ApiResponse.error(
          res,
          "Please upload at least one supporting document to use the AI Smart Assistant. A voice note or written notes can add extra detail, but a document is required.",
          422
        );
      }

      await failStaleSessions({ client: clientId });

      const running = await tempSessions.countDocuments({
        client: clientId,
        status: "processing",
      });

      if (running >= MAX_CONCURRENT_SESSIONS_PER_CLIENT) {
        await removeUploadedFiles([...documentFiles, voiceFile]);
        log.warn("analyze:rejected-concurrency", { client: clientId, running });
        return ApiResponse.error(
          res,
          "You already have analyses running. Please wait for them to finish before starting another.",
          429
        );
      }

      // Optimized PDFs are read in place; they stay prepared until the case is
      // submitted (or expire), so they are never removed here.
      const claimed = [];
      for (const token of tokens) {
        const file = await preparedDocuments.peek(clientId, token);
        if (!file) {
          await removeUploadedFiles([...documentFiles, voiceFile]);
          return ApiResponse.error(
            res,
            "An optimized document has expired. Please remove it and add it again.",
            410
          );
        }
        claimed.push(file);
      }
      documentFiles = [...documentFiles, ...claimed];

      const typedDescription = ((req.body && req.body.issueDescription) || "")
        .toString()
        .trim()
        .slice(0, 5000);

      const liveVoiceTranscript = ((req.body && req.body.voiceTranscript) || "")
        .toString()
        .trim()
        .slice(0, MAX_LIVE_TRANSCRIPT_CHARS);

      const liveVoiceLanguage = liveVoiceTranscript
        ? normaliseLanguageCode(req.body && req.body.voiceLanguage) ||
          detectTranscriptLanguage(liveVoiceTranscript)
        : "";

      // Only what the client needs to show the documents that were read. The
      // files themselves are temporary inputs: no Document record is created
      // and nothing is kept once the analysis ends. The client sends the
      // documents again with the case submission.
      const uploadedDocsForDb = documentFiles.map((file) => ({
        documentId: null,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: "",
        url: "",
        documentType: file.mimetype,
        ocrQuality: "Pending",
      }));

      let session;
      try {
        session = await tempSessions.create({
          client: clientId,
          requestId: requestId || undefined,
          status: "processing",
          uploadedDocuments: uploadedDocsForDb,
          voiceTranscript: liveVoiceTranscript,
          voiceTranscriptLanguage: liveVoiceLanguage,
          voiceTranscriptSource: liveVoiceTranscript ? "live" : "none",
          progress: {
            stage: "queued",
            message: "Preparing your documents",
            percent: 0,
            current: null,
            total: documentFiles.length,
            updatedAt: new Date(),
          },
        });
      } catch (e) {
        if (e.code === 11000 && requestId) {
          const winner = await tempSessions.findOne({ client: clientId, requestId });
          if (winner) {
            await removeUploadedFiles([...documentFiles, voiceFile]);
            return ApiResponse.success(res, "Analysis already started.", {
              sessionId: winner._id.toString(),
              status: winner.status,
              progress: winner.progress,
              uploadedDocuments: winner.uploadedDocuments,
              documentCount: winner.uploadedDocuments.length,
            }, 202);
          }
        }
        throw e;
      }

      const payload = {
        sessionId: session._id.toString(),
        status: session.status,
        progress: session.progress,
        uploadedDocuments: session.uploadedDocuments,
        documentCount: documentFiles.length,
      };

      log.info("analyze:accepted", {
        session: session._id,
        client: clientId,
        documents: documentFiles.length,
        voice: Boolean(voiceFile),
      });

      ApiResponse.success(res, "Analysis started.", payload, 202);

      // The analysis runs in this process after the response (tracked so a
      // graceful shutdown waits for it); the client follows progress over the /ai socket and by
      // polling the session. Temporary uploads are removed when it ends.
      runInBackground("smart-case:analysis", async () => {
        try {
          await new AiSmartCasePipeline().run({
            session,
            documentFiles,
            voiceFile,
            typedDescription,
            liveVoiceTranscript,
            liveVoiceLanguage,
          });
        } finally {
          await removeUploadedFiles([...documentFiles, voiceFile]);
        }
      });

      return undefined;
    } catch (error) {
      log.error("analyze:failed", error);
      await removeUploadedFiles([...documentFiles, voiceFile]);
      if (res.headersSent) return undefined;
      return next(error);
    }
  }

  async getSmartCaseHistory(req, res, next) {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50);

      const sessions = await AiSmartCaseSession.find({ client: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select("-ocrExtractedText")
        .populate("createdCase", "title status createdAt")
        .lean();

      return ApiResponse.success(res, "AI Smart Case sessions retrieved successfully.", {
        sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSmartCaseSessionById(req, res, next) {
    try {
      if (!req.params.id || typeof req.params.id !== "string") {
        return ApiResponse.error(res, "Session not found.", 404);
      }

      // A session being drafted, or else one already submitted with its case.
      let session =
        (await tempSessions.findOne({ _id: req.params.id, client: req.user._id })) ||
        (await AiSmartCaseSession.findOne({ _id: req.params.id, client: req.user._id }).populate("createdCase"));

      if (!session) {
        return ApiResponse.error(res, "Session not found.", 404);
      }

      if (isStale(session)) {
        log.warn("session:reaping-stale", { session: session._id });
        session = (await markAbandoned(session)) || session;
      }

      return ApiResponse.success(res, "Session retrieved successfully.", {
        session,
        sessionId: session._id.toString(),
        status: session.status,
        progress: session.progress,
        extracted: session.extractedData,
        uploadedDocuments: session.uploadedDocuments,
        voiceTranscript: session.voiceTranscript,
        voiceTranscriptLanguage: session.voiceTranscriptLanguage,
        voiceTranscriptSource: session.voiceTranscriptSource,
        voiceTranscriptionFailed: session.voiceTranscriptionFailed,
        extractionWarnings: session.warnings,
        failureReason: session.failureReason,
      });
    } catch (error) {
      next(error);
    }
  }

  async linkSessionToCase(req, res, next) {
    try {
      const { caseId } = req.body || {};

      if (!caseId || typeof caseId !== "string") {
        return ApiResponse.error(res, "A valid caseId is required.", 400);
      }
      if (!req.params.id || typeof req.params.id !== "string") {
        return ApiResponse.error(res, "Session not found.", 404);
      }

      const session = await AiSmartCaseSession.findOneAndUpdate(
        { _id: req.params.id, client: req.user._id },
        { $set: { createdCase: caseId } },
        { new: true }
      );

      if (!session) {
        return ApiResponse.error(res, "Session not found.", 404);
      }

      return ApiResponse.success(res, "Session linked to case.", { session });
    } catch (error) {
      next(error);
    }
  }
}

function isStale(session) {
  if (session.status !== "processing") return false;
  const last = session.progress?.updatedAt || session.updatedAt || session.createdAt;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() > PIPELINE_BUDGET_MS + STALE_GRACE_MS;
}

const ABANDONED_REASON =
  "The analysis was interrupted and could not be completed. Please try again.";

function abandonedPatch() {
  return {
    $set: {
      status: "failed",
      failureReason: ABANDONED_REASON,
      progress: {
        stage: "failed",
        message: ABANDONED_REASON,
        percent: 100,
        current: null,
        total: null,
        updatedAt: new Date(),
      },
    },
  };
}

async function markAbandoned(session) {
  return tempSessions.findOneAndUpdate(
    { _id: session._id, client: session.client, status: "processing" },
    abandonedPatch()
  );
}

// Marks drafting sessions whose analysis stopped reporting as failed. With a
// client, only that client's sessions; without, every session (maintenance).
async function failStaleSessions(filter = {}) {
  const cutoff = Date.now() - (PIPELINE_BUDGET_MS + STALE_GRACE_MS);

  try {
    const sessions = filter.client
      ? await tempSessions.find({ client: filter.client })
      : await tempSessions.listAll();
    let modified = 0;
    for (const session of sessions) {
      const last = new Date(session.progress?.updatedAt || session.updatedAt || 0).getTime();
      if (session.status === "processing" && last < cutoff && (await markAbandoned(session))) {
        modified += 1;
      }
    }

    if (modified > 0) {
      log.warn("recovery:failed-stale-sessions", { count: modified });
    }
    return modified;
  } catch (e) {
    log.error("recovery:sweep-failed", e);
    return 0;
  }
}

// Removes temporary AI inputs; prepared (optimized) PDFs are kept for submission.
async function removeUploadedFiles(files) {
  await tempFiles.removeTempFiles(files);
}

module.exports = new AiSmartCaseController();
module.exports.failStaleSessions = failStaleSessions;
