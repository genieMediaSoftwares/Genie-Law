const express = require("express");
const courtController = require("../controllers/court/courtController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", courtController.getCourts);

module.exports = router;
