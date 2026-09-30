const express = require("express");
const chatController = require("../controllers/chat/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload.middleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", chatController.getOrCreateChat);
router.get("/", chatController.getChats);
router.post("/:chatId/messages", chatController.sendMessage);
router.get("/:chatId/messages", chatController.getMessages);
router.put("/:chatId/read", chatController.markAsRead);
router.post("/:chatId/attachments", upload.single("file"), chatController.uploadAttachment);

module.exports = router;
