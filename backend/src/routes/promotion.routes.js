const express = require("express");
const router = express.Router();
const promotionController = require("../controllers/promotion/promotionController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", promotionController.list);
router.get("/:id", promotionController.getById);
router.post("/", promotionController.create);
router.put("/:id", promotionController.update);
router.delete("/:id", promotionController.remove);
router.post("/toggle/:id", promotionController.toggle);
router.post("/validate", promotionController.validateCode);

module.exports = router;
