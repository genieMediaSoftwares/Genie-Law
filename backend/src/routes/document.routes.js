const express = require("express");
const documentController = require("../controllers/document/documentController");
const upload = require("../middleware/upload.middleware");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/upload",
  upload.single("acknowledgement"),
  documentController.uploadDocument
);

router.get("/", documentController.getDocuments);

router.get("/:id/view", documentController.viewDocument);
router.get("/:id/preview", documentController.previewDocument);
router.get("/:id/download", documentController.downloadDocument);

router.get("/:id", documentController.getDocumentById);

router.patch("/:id", documentController.renameDocument);

router.post(
  "/:id/replace",
  upload.single("acknowledgement"),
  documentController.replaceDocument
);

router.delete("/:id", documentController.deleteDocument);

module.exports = router;
