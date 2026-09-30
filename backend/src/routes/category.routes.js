const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category/categoryController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// The legal case taxonomy (config/legalCategories.json): the categories and
// sub-types cases are filed and validated under. Public and read-only; the
// apps load it at startup instead of keeping their own copy.
router.get("/legal", categoryController.legalTaxonomy);

router.use(authMiddleware);

router.get("/", categoryController.list);
router.get("/:id", categoryController.getById);
// Changing categories is an admin action.
router.post("/", roleMiddleware("admin"), categoryController.create);
router.put("/:id", roleMiddleware("admin"), categoryController.update);
router.delete("/:id", roleMiddleware("admin"), categoryController.remove);

module.exports = router;
