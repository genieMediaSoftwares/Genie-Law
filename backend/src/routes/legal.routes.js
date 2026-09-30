const express = require("express");
const legalController = require("../controllers/legal/legalController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Public: terms and privacy have to be readable before signing in.
router.get("/documents", legalController.listActive);
router.get("/documents/:type", legalController.getByType);

// Signed-in: what this user still has to accept, and their own history.
router.get("/pending", authMiddleware, legalController.listPending);
router.post("/accept", authMiddleware, legalController.accept);
router.get("/acceptances", authMiddleware, legalController.myAcceptances);

module.exports = router;
