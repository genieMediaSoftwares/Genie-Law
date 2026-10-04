const express = require("express");
const multer = require("multer");
const aiController = require("../controllers/ai/aiController");
const aiSmartCaseController = require("../controllers/ai/aiSmartCaseController");
const researchController = require("../controllers/ai/researchController");

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload.middleware");
const { fileTooLargeBody } = require("../config/uploadLimits");

const router = express.Router();

function handleUploadErrors(uploadMiddleware, overrides = {}) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json(fileTooLargeBody());
        }
        const messages = {
          LIMIT_FILE_COUNT: "You can attach up to 10 documents.",
          LIMIT_UNEXPECTED_FILE:
            "You can attach up to 10 documents and one voice note.",
          LIMIT_PART_COUNT: "Too many parts in the upload.",
          ...overrides,
        };
        return res.status(400).json({
          success: false,
          message: messages[err.code] || "That upload could not be accepted.",
        });
      }

      // File-type rejections from the upload filter carry their own status.
      if (err.isOperational) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code,
        });
      }

      // Anything else (e.g. the file store failing to save) is a server error.
      return next(err);
    });
  };
}

router.use(authMiddleware);

router.post("/chat", aiController.chat);
router.post(
  "/transcribe",
  handleUploadErrors(upload.single("audio")),
  aiController.transcribe
);

router.get("/research/cases", researchController.listCases);
router.get("/research/cases/:caseId/documents", researchController.listDocuments);
router.post("/research/sessions", researchController.startCaseResearch);
router.post("/research/:id/relevant-cases", researchController.searchRelevantCases);

router.get("/conversations", aiController.getConversations);
router.get("/conversations/:id", aiController.getConversationById);
router.post("/conversations", aiController.createConversation);
router.delete("/conversations/:id", aiController.deleteConversation);
router.delete("/conversations", aiController.deleteAllConversations);

router.post(
  "/documents/relevance",
  handleUploadErrors(upload.submission.single("document"), {
    LIMIT_UNEXPECTED_FILE: "Send one document at a time to be checked.",
  }),
  aiSmartCaseController.checkDocumentRelevance
);
router.post(
  "/smart-case/optimize",
  handleUploadErrors(upload.optimizeInput.single("document"), {
    LIMIT_UNEXPECTED_FILE: "Send one PDF at a time for optimization.",
  }),
  aiSmartCaseController.optimizeDocument
);
router.post(
  "/smart-case/analyze",
  handleUploadErrors(
    upload.fields([
      { name: "documents", maxCount: 10 },
      { name: "voice", maxCount: 1 },
    ])
  ),
  aiSmartCaseController.analyzeSmartCase
);
router.get("/smart-case/history", aiSmartCaseController.getSmartCaseHistory);
router.get("/smart-case/session/:id", aiSmartCaseController.getSmartCaseSessionById);
router.post("/smart-case/session/:id/link-case", aiSmartCaseController.linkSessionToCase);

module.exports = router;
