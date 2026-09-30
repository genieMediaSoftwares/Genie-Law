// Case submission: the only place a client's case documents become permanent.
//
// Documents chosen while posting a case stay on the client (and, if the AI
// assistant read them, in temporary AI storage) until the client presses
// "Submit Case". The submission carries the case details and the documents
// together, and this service commits them as one unit:
//
//   1. validate the case, the selected lawyers and every document (nothing is
//      stored yet — uploads are held in memory)
//   2. store the documents, create their Document records, create the case
//      and save the AI analysis that drafted the case (until now it was only
//      temporary — services/ai/tempSessionStore)
//   3. on any failure, remove every file and record created in step 2
//
// A repeated submission with the same clientRequestId returns the case the
// first one created, so a double tap never creates two cases.

const path = require("path");
const crypto = require("crypto");
const Case = require("../../models/Case");
const Document = require("../../models/Document");
const AiSmartCaseSession = require("../../models/AiSmartCaseSession");
const fileStore = require("../fileStore");
const preparedDocuments = require("../ai/preparedDocuments");
const tempSessions = require("../ai/tempSessionStore");
const caseRequestService = require("./caseRequestService");
const { AI_MAX_DOCUMENTS, MAX_DOCUMENT_SIZE, FILE_TOO_LARGE_MESSAGE } = require("../../config/uploadLimits");
const { generateId } = require("../../models/ids");
// Required lazily: the relevance service pulls in the AI client.
const relevance = () => require("../ai/documentRelevanceService");

// The AI assistant's documents plus one manually added acknowledgement.
const MAX_CASE_DOCUMENTS = AI_MAX_DOCUMENTS + 1;
const CASES_PREFIX = "uploads/cases";
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

// Case documents accepted on submission, with how each one's content is checked.
const DOCUMENT_TYPES = {
  ".pdf": { mime: "application/pdf", looksValid: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  ".png": { mime: "image/png", looksValid: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  ".jpg": { mime: "image/jpeg", looksValid: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  ".jpeg": { mime: "image/jpeg", looksValid: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  ".webp": {
    mime: "image/webp",
    looksValid: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    looksValid: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  },
  ".txt": { mime: "text/plain", looksValid: (b) => !b.subarray(0, 4096).includes(0) },
  ".md": { mime: "text/markdown", looksValid: (b) => !b.subarray(0, 4096).includes(0) },
  ".csv": { mime: "text/csv", looksValid: (b) => !b.subarray(0, 4096).includes(0) },
};

const EXTENSION_BY_MIME = Object.fromEntries(
  Object.entries(DOCUMENT_TYPES).map(([ext, { mime }]) => [mime, ext])
);

class SubmissionError extends Error {
  constructor(message, statusCode = 400, code) {
    super(message);
    this.statusCode = statusCode;
    if (code) this.code = code;
  }
}

const safeName = (value, fallback) => {
  const name = String(value || "").replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 200);
  return name || fallback;
};

const extensionOf = (file) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (DOCUMENT_TYPES[ext]) return ext;
  return EXTENSION_BY_MIME[file.mimetype] || null;
};

// Checks one in-memory upload and returns what will be stored.
function validateUpload(file) {
  const name = safeName(file.originalname, "document");
  const ext = extensionOf(file);
  if (!ext) {
    throw new SubmissionError(`${name}: unsupported file type. Allowed: PDF, JPG, PNG, WEBP, DOCX, TXT, MD, CSV.`, 415);
  }
  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new SubmissionError(`${name} is empty.`);
  }
  if (buffer.length > MAX_DOCUMENT_SIZE || Number(file.size) > MAX_DOCUMENT_SIZE) {
    throw new SubmissionError(FILE_TOO_LARGE_MESSAGE, 413, "FILE_TOO_LARGE");
  }
  if (!DOCUMENT_TYPES[ext].looksValid(buffer)) {
    throw new SubmissionError(`${name} does not look like a valid ${ext.slice(1).toUpperCase()} file.`, 415);
  }
  return { name, ext, buffer, mimeType: DOCUMENT_TYPES[ext].mime };
}

function caseFields(body, { client, lawyerIds, requestKey }) {
  const {
    title, description, category, subcategory, location, budgetRange,
    urgency, preferredCourt, voiceUrl, voiceTranscript, city, district, state,
    country, latitude, longitude, placeId, incidentDate, opposingParty,
    firNumber, policeStation, bailDetails, claimAmount,
  } = body;

  return {
    client,
    title,
    description,
    category,
    subcategory: subcategory || "",
    location,
    budgetRange: budgetRange || "",
    urgency,
    preferredCourt: preferredCourt || "",
    documents: [],
    selectedLawyer: null,
    lawyerRequests: lawyerIds.map((lawyer) => ({ lawyer, status: "Pending" })),
    clientRequestId: requestKey,
    status: "Awaiting Lawyer Acceptance",
    milestones: [
      { title: "Case Posted", isCompleted: true },
      { title: "Awaiting Lawyer Acceptance", isCompleted: true },
      { title: "In Progress", isCompleted: false },
      { title: "Closed", isCompleted: false },
    ],
    voiceUrl: voiceUrl || "",
    voiceTranscript: voiceTranscript || "",
    locationCity: city || "",
    locationDistrict: district || "",
    locationState: state || "",
    locationCountry: country || "",
    locationLatitude: latitude ? Number(latitude) : 0.0,
    locationLongitude: longitude ? Number(longitude) : 0.0,
    locationPlaceId: placeId || "",
    incidentDate: incidentDate && !Number.isNaN(Date.parse(incidentDate)) ? new Date(incidentDate) : null,
    opposingParty: opposingParty || "",
    firNumber: firNumber || "",
    policeStation: policeStation || "",
    bailDetails: bailDetails || "",
    claimAmount: claimAmount != null && Number.isFinite(Number(claimAmount)) ? Number(claimAmount) : 0,
  };
}

// The AI analysis fields kept with a submitted case.
const SESSION_FIELDS = [
  "requestId", "status", "progress", "failureReason", "warnings",
  "voiceTranscriptionFailed", "ocrExtractedText", "voiceTranscript",
  "voiceTranscriptLanguage", "voiceTranscriptSource", "serverVoiceTranscript",
  "extractedData",
];
const pickSessionFields = (session) =>
  Object.fromEntries(SESSION_FIELDS.filter((field) => session[field] !== undefined).map((field) => [field, session[field]]));

const findDuplicate = (client, requestKey) =>
  requestKey ? Case.findOne({ client, clientRequestId: requestKey }) : null;

// Removes everything a failed submission created. Best effort: a failure here
// is logged, never allowed to hide the original error.
async function rollback({ storedKeys, documentIds, caseId, aiSessionId }) {
  const results = await Promise.allSettled([
    ...storedKeys.map((key) => fileStore.remove(key)),
    documentIds.length ? Document.deleteMany({ _id: { $in: documentIds } }) : null,
    caseId ? Case.deleteOne({ _id: caseId }) : null,
    aiSessionId ? AiSmartCaseSession.deleteOne({ _id: aiSessionId }) : null,
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[case-submission] rollback step failed:", result.reason && result.reason.message);
    }
  }
}

/**
 * Validates and commits a case submission.
 *
 * @param {object} input
 * @param {object} input.user            the authenticated user
 * @param {object} input.body            case details (as for POST /cases)
 * @param {Array}  input.files           in-memory uploads (multer memoryStorage)
 * @param {Array}  input.preparedTokens  optimized PDFs held since AI analysis
 * @param {Array}  input.verificationTokens  proof each document was accepted
 *                                         by the relevance check
 * @returns {Promise<{ case: object, duplicate: boolean }>}
 * @throws {SubmissionError} with statusCode for anything the client must fix
 */
async function submitCase({ user, body = {}, files = [], preparedTokens = [], verificationTokens = [] }) {
  if (!user || user.role !== "client") {
    throw new SubmissionError("Only clients can post a case.", 403);
  }
  const client = user._id;

  const requestKey =
    typeof body.clientRequestId === "string" && REQUEST_KEY_PATTERN.test(body.clientRequestId)
      ? body.clientRequestId
      : undefined;

  const existing = await findDuplicate(client, requestKey);
  if (existing) return { case: existing, duplicate: true };

  // --- 1. Validate everything before storing anything ----------------------

  const tokens = [...new Set([].concat(preparedTokens || []).map(String).filter(Boolean))];
  if (files.length + tokens.length > MAX_CASE_DOCUMENTS) {
    throw new SubmissionError(`You can attach up to ${MAX_CASE_DOCUMENTS} documents.`);
  }

  const selection = await caseRequestService.validateSelectedLawyers(client, body.selectedLawyers);
  if (selection.error) throw new SubmissionError(selection.error);

  const caseId = generateId();
  const newCase = new Case({ _id: caseId, ...caseFields(body, { client, lawyerIds: selection.lawyerIds, requestKey }) });
  try {
    await newCase.validate();
  } catch (error) {
    throw new SubmissionError(error.message || "Please complete the case details.");
  }

  const uploads = files.map(validateUpload);

  const notVerified = (name) =>
    new SubmissionError(`${name} has not been verified as relevant to your case. Please remove it or check it again.`, 422);
  for (const upload of uploads) {
    if (!relevance().isVerified(client, upload.buffer, verificationTokens)) throw notVerified(upload.name);
  }

  for (const token of tokens) {
    const prepared = await preparedDocuments.peek(client, token);
    const buffer = prepared ? await fileStore.read(prepared.path) : null;
    if (!buffer) {
      throw new SubmissionError("An optimized document has expired. Please remove it and add it again.", 410);
    }
    if (!relevance().isVerified(client, buffer, verificationTokens)) throw notVerified(prepared.originalname);
  }

  // The AI analysis that drafted this case, if any. Only the client's own,
  // finished analysis is kept.
  const aiSessionId = typeof body.aiSessionId === "string" ? body.aiSessionId : "";
  const draftSession = aiSessionId ? await tempSessions.findOne({ _id: aiSessionId, client }) : null;

  // --- 2. Commit: store files, create records, create the case -------------

  const created = { storedKeys: [], documentIds: [], caseId: null, aiSessionId: null };
  const documentIdsByName = new Map();
  try {
    const stored = [];

    for (const upload of uploads) {
      const key = `${CASES_PREFIX}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${upload.ext}`;
      await fileStore.save(key, upload.buffer, upload.mimeType);
      created.storedKeys.push(key);
      stored.push({ key, name: upload.name, mimeType: upload.mimeType, size: upload.buffer.length });
    }

    for (const token of tokens) {
      const file = await preparedDocuments.claim(client, token);
      if (!file) {
        throw new SubmissionError("An optimized document has expired. Please remove it and add it again.", 410);
      }
      created.storedKeys.push(file.path);
      // Rolled back below (created.storedKeys) so nothing is orphaned.
      if (!(Number(file.size) <= MAX_DOCUMENT_SIZE)) {
        throw new SubmissionError(FILE_TOO_LARGE_MESSAGE, 413, "FILE_TOO_LARGE");
      }
      stored.push({ key: file.path, name: safeName(file.originalname, "document.pdf"), mimeType: file.mimetype, size: file.size });
    }

    for (const file of stored) {
      const record = await Document.create({
        clientId: client,
        caseId,
        originalName: file.name,
        name: file.name,
        fileName: file.key.split("/").pop(),
        filePath: file.key,
        mimeType: file.mimeType,
        fileSize: file.size,
      });
      created.documentIds.push(record._id);
      documentIdsByName.set(file.name, record._id);
    }

    if (draftSession && draftSession.status === "extracted") {
      await AiSmartCaseSession.create({
        ...pickSessionFields(draftSession),
        _id: draftSession._id,
        client,
        createdCase: caseId,
        uploadedDocuments: (draftSession.uploadedDocuments || []).map((document) => ({
          ...document,
          documentId: documentIdsByName.get(document.originalName) || null,
        })),
      });
      created.aiSessionId = draftSession._id;
    }

    newCase.documents = stored.map((file) => ({ name: file.name, url: `/${file.key}`, size: String(file.size) }));
    await newCase.save();
    created.caseId = caseId;
  } catch (error) {
    await rollback(created);

    // A concurrent submission with the same key won the race.
    if (error && error.code === 11000 && requestKey) {
      const winner = await findDuplicate(client, requestKey);
      if (winner) return { case: winner, duplicate: true };
    }
    throw error;
  }

  // --- 3. The draft is now saved with the case; drop the temporary copy ----

  if (draftSession) {
    await tempSessions
      .remove(client, draftSession._id)
      .catch((error) => console.warn("[case-submission] temporary AI session not removed:", error.message));
  }

  return { case: newCase, duplicate: false };
}

module.exports = { submitCase, SubmissionError, MAX_CASE_DOCUMENTS, validateUpload };
