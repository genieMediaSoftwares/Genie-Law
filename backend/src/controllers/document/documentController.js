const Document = require("../../models/Document");
const Case = require("../../models/Case");
const storageService = require("../../services/storageService");
const fileStore = require("../../services/fileStore");
const notificationService = require("../../services/notification/notificationService");
const ApiResponse = require("../../config/ApiResponse");
const path = require("path");
const {
  displayName,
  sanitiseDisplayName,
  contentDisposition,
} = require("../../utils/documentName");
const { docxToBlocks } = require("../../services/document/docxPreview");

// The file-store key for a document, or null when filePath points outside uploads/.
const resolveStoredPath = (document) => fileStore.toKey(document.filePath);

const publicDocument = (document) => {
  const plain = typeof document.toObject === "function"
    ? document.toObject()
    : { ...document };

  return { ...plain, name: displayName(document) };
};

const sendStoredFile = async (req, res, disposition) => {
  const { id } = req.params;
  const document = await Document.findById(id);

  if (!document) {
    return ApiResponse.error(res, "Document not found.", 404);
  }

  if (!(await canAccessDocument(req.user, document))) {
    return ApiResponse.error(res, "Document not found.", 404);
  }

  const storedKey = resolveStoredPath(document);
  const stored = storedKey ? await fileStore.stat(storedKey) : null;

  if (!stored) {
    return ApiResponse.error(res, "Document file is no longer available.", 404);
  }

  res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    contentDisposition(disposition, displayName(document))
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.setHeader("Cache-Control", "private, no-store");

  const { size } = stored;

  res.setHeader("Accept-Ranges", "bytes");

  const rangeHeader = req.headers.range;
  let range = null;

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());

    if (!match || (match[1] === "" && match[2] === "")) {
      res.setHeader("Content-Range", `bytes */${size}`);
      return res.status(416).end();
    }

    let start;
    let end;

    if (match[1] === "") {
      const suffixLength = Number(match[2]);
      start = Math.max(0, size - suffixLength);
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      res.setHeader("Content-Range", `bytes */${size}`);
      return res.status(416).end();
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", end - start + 1);
    range = { start, end };
  } else {
    res.setHeader("Content-Length", size);
  }

  const body = range
    ? await fileStore.readRange(storedKey, range.start, range.end)
    : await fileStore.read(storedKey);

  if (!body) {
    res.removeHeader("Content-Range");
    res.removeHeader("Content-Length");
    res.status(200);
    return ApiResponse.error(res, "Unable to read this document.", 500);
  }

  return res.end(body);
};

const ENGAGED_CASE_STATUSES = ["Accepted", "In Progress"];

const clientIdsVisibleToLawyer = (lawyerId) =>
  Case.find({
    $or: [{ assignedLawyer: lawyerId }, { selectedLawyer: lawyerId }],
  }).distinct("client");

const scopeForUser = async (user) => {
  if (user.role === "admin") return {};

  if (user.role === "lawyer") {
    return {
      $or: [
        { clientId: user._id },
        { clientId: { $in: await clientIdsVisibleToLawyer(user._id) } },
      ],
    };
  }

  return { clientId: user._id };
};

const notifyCounterpartiesOfUpload = async (user, document) => {
  const isLawyer = user.role === "lawyer";
  const cases = await Case.find({
    status: { $in: ENGAGED_CASE_STATUSES },
    ...(isLawyer
      ? { $or: [{ assignedLawyer: user._id }, { selectedLawyer: user._id }] }
      : { client: user._id }),
  })
    .select("client assignedLawyer selectedLawyer title")
    .lean();

  const notified = new Set();
  for (const caseItem of cases) {
    const receiverId = isLawyer
      ? caseItem.client
      : caseItem.assignedLawyer || caseItem.selectedLawyer;
    if (!receiverId || notified.has(receiverId.toString())) continue;
    notified.add(receiverId.toString());

    const who = user.fullName || (isLawyer ? "Your lawyer" : "Your client");
    await notificationService.createAndSendNotification({
      senderId: user._id,
      receiverId,
      type: "document_uploaded",
      title: "New Document Uploaded",
      message: caseItem.title
        ? `${who} uploaded a new document in "${caseItem.title}".`
        : `${who} uploaded a new document.`,
      referenceId: document._id.toString(),
    });
  }
};

const isOwner = (user, document) =>
  document.clientId.toString() === user._id.toString();

const canAccessDocument = async (user, document) => {
  if (user.role === "admin") return true;

  if (isOwner(user, document)) return true;

  if (user.role === "lawyer") {
    const clientIds = await clientIdsVisibleToLawyer(user._id);
    return clientIds.some((id) => id.toString() === document.clientId.toString());
  }

  return false;
};

class DocumentController {
  async uploadDocument(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, "No file uploaded.", 400);
      }

      const clientId = req.user._id;
      const issueId = req.body.issueId || null;

      const metadata = await storageService.uploadFile(req.file, "documents");

      const document = await Document.create({
        clientId,
        issueId,
        originalName: metadata.originalName,
        fileName: metadata.fileName,
        filePath: metadata.filePath,
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize
      });

      try {
        await notifyCounterpartiesOfUpload(req.user, document);
      } catch (notifyError) {
        console.error(
          "⚠️ document_uploaded notification failed:",
          notifyError.message
        );
      }

      return ApiResponse.success(
        res,
        "Document uploaded successfully.",
        publicDocument(document),
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getDocumentById(req, res, next) {
    try {
      const { id } = req.params;
      const document = await Document.findById(id);
      
      if (!document) {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      if (!(await canAccessDocument(req.user, document))) {
        return ApiResponse.error(res, "Unauthorized.", 403);
      }

      return ApiResponse.success(
        res,
        "Document details fetched successfully.",
        publicDocument(document)
      );
    } catch (error) {
      next(error);
    }
  }

  async getDocuments(req, res, next) {
    try {
      const query = await scopeForUser(req.user);

      const search = String(req.query.search || "").trim();
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
          { name: { $regex: escaped, $options: "i" } },
          { originalName: { $regex: escaped, $options: "i" } },
        ];
      }

      const TYPE_FILTERS = {
        pdf: /^application\/pdf$/i,
        doc: /wordprocessingml|msword/i,
        image: /^image\//i,
        text: /^text\//i,
        audio: /^audio\//i,
      };
      const type = String(req.query.type || "").trim().toLowerCase();
      if (type && type !== "all" && TYPE_FILTERS[type]) {
        query.mimeType = { $regex: TYPE_FILTERS[type] };
      }

      const SORTS = {
        recent: { uploadedAt: -1 },
        oldest: { uploadedAt: 1 },
        modified: { updatedAt: -1 },
        name_asc: { name: 1, originalName: 1 },
        name_desc: { name: -1, originalName: -1 },
        size_desc: { fileSize: -1 },
        size_asc: { fileSize: 1 },
      };
      const sort = SORTS[String(req.query.sort || "").trim()] || SORTS.recent;

      const documents = await Document.find(query).sort(sort);

      return ApiResponse.success(
        res,
        "Documents fetched successfully.",
        documents.map(publicDocument)
      );
    } catch (error) {
      next(error);
    }
  }

  async renameDocument(req, res, next) {
    try {
      const document = await Document.findById(req.params.id);

      if (!document) {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      const isOwner = document.clientId.toString() === req.user._id.toString();
      if (!isOwner && req.user.role !== "admin") {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      const result = sanitiseDisplayName(req.body?.name, document);
      if (!result.ok) {
        return ApiResponse.error(res, result.reason, 400);
      }

      document.name = result.name;
      await document.save();

      return ApiResponse.success(
        res,
        "Document renamed successfully.",
        publicDocument(document)
      );
    } catch (error) {
      next(error);
    }
  }

  async replaceDocument(req, res, next) {
    let uploadedPath = req.file?.path || null;

    try {
      if (!req.file) {
        return ApiResponse.error(res, "No replacement file uploaded.", 400);
      }

      const document = await Document.findById(req.params.id);

      if (!document) {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      const isOwner = document.clientId.toString() === req.user._id.toString();
      if (!isOwner && req.user.role !== "admin") {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      const previousPath = document.filePath;
      const metadata = await storageService.uploadFile(req.file, "documents");

      const hadCustomName = Boolean((document.name || "").trim());
      document.originalName = metadata.originalName;
      document.fileName = metadata.fileName;
      document.filePath = metadata.filePath;
      document.mimeType = metadata.mimeType;
      document.fileSize = metadata.fileSize;
      document.contentUpdatedAt = new Date();

      if (hadCustomName) {
        const stem = path.parse(document.name).name;
        const renamed = sanitiseDisplayName(stem, document);
        document.name = renamed.ok ? renamed.name : metadata.originalName;
      } else {
        document.name = "";
      }

      await document.save();

      uploadedPath = null;
      if (previousPath && previousPath !== document.filePath) {
        try {
          await storageService.deleteFile(previousPath);
        } catch (cleanupError) {
          console.error(
            "⚠️ replaced document: old file could not be removed:",
            cleanupError.message
          );
        }
      }

      return ApiResponse.success(
        res,
        "Document replaced successfully.",
        publicDocument(document)
      );
    } catch (error) {
      if (uploadedPath) {
        fileStore.remove(uploadedPath).catch(() => {});
      }
      next(error);
    }
  }

  async previewDocument(req, res, next) {
    try {
      const document = await Document.findById(req.params.id);

      if (!document) {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      if (!(await canAccessDocument(req.user, document))) {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      const isDocx =
        document.mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        /\.docx$/i.test(document.fileName || "");

      if (!isDocx) {
        return ApiResponse.error(
          res,
          "This file type cannot be previewed.",
          415
        );
      }

      const storedKey = resolveStoredPath(document);
      const content = storedKey ? await fileStore.read(storedKey) : null;
      if (!content) {
        return ApiResponse.error(res, "Document file is no longer available.", 404);
      }

      let converted;
      try {
        converted = docxToBlocks(content);
      } catch (conversionError) {
        console.warn(
          `Document preview failed for ${document._id}:`,
          conversionError.message
        );
        return ApiResponse.error(
          res,
          "This document appears to be damaged and could not be previewed.",
          422
        );
      }

      res.setHeader("Cache-Control", "private, no-store");

      return ApiResponse.success(res, "Document preview generated.", {
        documentId: document._id,
        name: displayName(document),
        mimeType: document.mimeType,
        blocks: converted.blocks,
        truncated: converted.truncated,
      });
    } catch (error) {
      next(error);
    }
  }

  async viewDocument(req, res, next) {
    try {
      return await sendStoredFile(req, res, "inline");
    } catch (error) {
      next(error);
    }
  }

  async downloadDocument(req, res, next) {
    try {
      return await sendStoredFile(req, res, "attachment");
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      const document = await Document.findById(id);
      
      if (!document) {
        return ApiResponse.error(res, "Document not found.", 404);
      }

      const isOwner = document.clientId.toString() === req.user._id.toString();
      if (!isOwner && req.user.role !== "admin") {
        return ApiResponse.error(res, "Unauthorized.", 403);
      }

      await storageService.deleteFile(document.filePath);

      await Document.findByIdAndDelete(id);

      return ApiResponse.success(res, "Document deleted successfully.", null);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DocumentController();
