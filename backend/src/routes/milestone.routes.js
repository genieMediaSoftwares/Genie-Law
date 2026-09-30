const express = require("express");
const router = express.Router();
const milestoneController = require("../controllers/milestone/milestoneController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/case/:caseId", milestoneController.listByCase);
router.post("/case/:caseId", milestoneController.create);
router.put("/:id", milestoneController.update);
router.delete("/:id", milestoneController.remove);

module.exports = router;