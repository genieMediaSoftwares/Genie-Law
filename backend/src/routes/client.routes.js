const express = require("express");
const clientController = require("../controllers/client/clientController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/profile", clientController.getClientProfile);
router.put("/profile", clientController.updateClientProfile);
router.get("/activity", clientController.getClientActivity);
router.get("/stats", clientController.getClientStats);

router.get("/", clientController.getClients);
router.get("/:id", clientController.getClientById);
router.post("/:id/notes", clientController.addNote);
router.get("/:id/notes", clientController.getNotes);
router.put("/:id/notes/:noteId", clientController.updateNote);
router.delete("/:id/notes/:noteId", clientController.deleteNote);

module.exports = router;
