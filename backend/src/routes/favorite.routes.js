const express = require("express");
const favoriteController = require("../controllers/favorite/favoriteController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", favoriteController.toggleFavorite);
router.get("/", favoriteController.getFavorites);
router.delete("/:id", favoriteController.removeFavorite);

module.exports = router;
