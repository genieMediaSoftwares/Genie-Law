const path = require("path");
const fileStore = require("../services/fileStore");
const ApiResponse = require("../config/ApiResponse");
const { docxToBlocks } = require("../services/document/docxPreview");

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".3gp": "audio/3gpp",
  ".amr": "audio/amr",
};

// Serves /uploads/<folder>/<file> from the file store. Mounted after
// fileAuthMiddleware, which decides who may read what. A missing file falls
// through to the JSON 404 handler.
const serveUpload = async (req, res, next) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const key = fileStore.toKey(`uploads${req.path}`);
    if (!key || key.split("/").length !== 3) return next();

    const info = await fileStore.stat(key);
    if (!info) return next();

    // ?preview=docx: the document's text as blocks, for in-app reading of case
    // attachments (Document records use /documents/:id/preview instead).
    if (req.query.preview === "docx") {
      const content = await fileStore.read(key);
      if (!content) return next();
      if (path.extname(key).toLowerCase() !== ".docx") {
        return ApiResponse.error(res, "This file type cannot be previewed.", 415);
      }
      let converted;
      try {
        converted = docxToBlocks(content);
      } catch {
        return ApiResponse.error(res, "This document appears to be damaged and could not be previewed.", 422);
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      return ApiResponse.success(res, "Document preview generated.", {
        name: path.basename(key),
        blocks: converted.blocks,
        truncated: converted.truncated,
      });
    }

    res.setHeader(
      "Content-Type",
      info.contentType || CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream"
    );
    res.setHeader("Content-Length", info.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");

    if (req.method === "HEAD") return res.end();
    const body = await fileStore.read(key);
    if (!body) return next();

    return res.end(body);
  } catch (error) {
    return next(error);
  }
};

module.exports = serveUpload;
