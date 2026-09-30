const express = require("express");
const placeController = require("../controllers/place/placeController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/autocomplete", placeController.autocomplete);
router.get("/details", placeController.details);

module.exports = router;
