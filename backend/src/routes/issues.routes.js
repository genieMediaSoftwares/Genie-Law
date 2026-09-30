const express = require("express");
const issueController = require("../controllers/issue/issueController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/create", issueController.createIssue);
router.get("/", issueController.getIssues);
router.get("/:id", issueController.getIssueById);
router.get("/:id/status", issueController.getIssueStatus);
router.put("/:id", issueController.updateIssue);
router.delete("/:id", issueController.deleteIssue);

module.exports = router;
