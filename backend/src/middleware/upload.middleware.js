const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fileStore = require("../services/fileStore");
const AppError = require("../utils/AppError");
const { AI_OPTIMIZE_MAX_INPUT_BYTES, MAX_DOCUMENT_SIZE } = require("../config/uploadLimits");

const EXTENSION_BY_MIME = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  "audio/3gpp": ".3gp",
  "audio/amr": ".amr",
};

// AI uploads (analysis inputs, voice notes) are temporary: they are removed
// once processed and swept by maintenance if left behind (services/ai/tempFiles).
const folderFor = (req) => {
  const url = req.originalUrl || "";
  if (url.includes("/ai/")) return "ai-temp";
  if (url.includes("/auth") || url.includes("/profile")) return "profiles";
  if (url.includes("/issues") || url.includes("/cases") || url.includes("/ai")) return "cases";
  if (url.includes("/certificates")) return "certificates";
  if (url.includes("/documents")) return "acknowledgements";
  return "documents";
};

// Stores each upload in the file store (R2, or uploads/ on disk) as it arrives,
// and describes it the way multer's disk storage did: `path` is the storage key
// ("uploads/<folder>/<file>"), which the rest of the code passes to fileStore.
const fileStoreStorage = {
  _handleFile(req, file, cb) {
    const chunks = [];
    let size = 0;
    file.stream.on("data", (chunk) => {
      size += chunk.length;
      // Past the limit: stop buffering; the file is rejected below.
      if (size <= MAX_DOCUMENT_SIZE) chunks.push(chunk);
    });
    file.stream.on("error", cb);
    file.stream.on("end", async () => {
      // Never write an oversized (or limit-truncated) file to storage.
      if (file.stream.truncated || size > MAX_DOCUMENT_SIZE) {
        const error = new multer.MulterError("LIMIT_FILE_SIZE", file.fieldname);
        return cb(error);
      }
      try {
        const folder = folderFor(req);
        const ext = EXTENSION_BY_MIME[file.mimetype] || path.extname(file.originalname || "").toLowerCase();
        const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
        const key = `uploads/${folder}/${filename}`;
        const buffer = Buffer.concat(chunks, size);
        await fileStore.save(key, buffer, file.mimetype || "application/octet-stream");
        cb(null, { destination: `uploads/${folder}`, filename, path: key, size });
      } catch (error) {
        cb(error);
      }
    });
  },
  _removeFile(req, file, cb) {
    // A rejected (oversized) file was never stored.
    if (!file || !file.path) return cb(null);
    fileStore.remove(file.path).then(() => cb(null), cb);
  },
};

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".docx", ".txt", ".md", ".csv",
  ".mp3", ".wav", ".m4a", ".webm", ".ogg", ".aac", ".3gp", ".amr"
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (
    Object.prototype.hasOwnProperty.call(EXTENSION_BY_MIME, file.mimetype) ||
    ALLOWED_EXTENSIONS.has(ext)
  ) {
    cb(null, true);
  } else {
    // 415 with a code the apps can show, not a 500.
    cb(
      new AppError(
        "Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, TXT, CSV and audio.",
        415,
        "UNSUPPORTED_FILE_TYPE"
      ),
      false
    );
  }
};

const upload = multer({
  storage: fileStoreStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE
  }
});

// Raw PDFs sent to the AI assistant for optimization may be larger than the
// normal limit; they are shrunk before anything keeps them.
upload.optimizeInput = multer({
  storage: fileStoreStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: AI_OPTIMIZE_MAX_INPUT_BYTES,
    files: 1
  }
});

// Case submission keeps files in memory: nothing is written to storage until
// the whole submission has been validated (services/case/caseSubmissionService).
upload.submission = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE,
    files: 11
  }
});

module.exports = upload;
