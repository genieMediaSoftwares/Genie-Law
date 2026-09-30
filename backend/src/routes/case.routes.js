const express = require("express");
const multer = require("multer");
const caseController = require("../controllers/case/caseController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload.middleware");
const { MAX_CASE_DOCUMENTS } = require("../services/case/caseSubmissionService");
const { fileTooLargeBody } = require("../config/uploadLimits");

// Parses the submission's documents into memory; turns upload errors into
// messages the client can show.
const submissionUpload = (req, res, next) => {
  upload.submission.array("documents", MAX_CASE_DOCUMENTS)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json(fileTooLargeBody());
      }
      const messages = {
        LIMIT_FILE_COUNT: `You can attach up to ${MAX_CASE_DOCUMENTS} documents.`,
        LIMIT_UNEXPECTED_FILE: `You can attach up to ${MAX_CASE_DOCUMENTS} documents.`,
      };
      return res.status(400).json({ success: false, message: messages[err.code] || "That upload could not be accepted." });
    }
    return res.status(415).json({ success: false, message: err.message || "Unsupported file type." });
  });
};

const router = express.Router();

router.use(authMiddleware);

router.post("/", caseController.createCase);
router.post("/submit", submissionUpload, caseController.submitCase);
router.get("/", caseController.getCases);
router.get("/status/in-progress", caseController.getInProgressCases);
router.get("/status/closed", caseController.getClosedCases);

router.get("/hearings/mine", caseController.getMyHearings);

router.get("/:id/timeline", caseController.getCaseTimeline);
router.get("/:id/lawyer", caseController.getCaseLawyer);
router.get("/:id", caseController.getCaseById);
router.post("/:id/proposals", caseController.submitProposal);
router.post("/:id/accept", caseController.acceptProposal);
router.post("/:id/reject", caseController.rejectProposal);
router.post("/:id/accept-request", caseController.acceptCaseRequest);
router.post("/:id/reject-request", caseController.rejectCaseRequest);
router.post("/:id/start", caseController.startCase);
router.post("/:id/complete", caseController.markCaseCompleted);
router.put("/:id/milestones", caseController.updateMilestone);
router.post("/:id/review", caseController.submitCaseReview);
router.post("/:id/hearings", caseController.addHearing);
router.put("/:id/hearings/:hearingId", caseController.updateHearing);
router.delete("/:id/hearings/:hearingId", caseController.deleteHearing);

module.exports = router;
