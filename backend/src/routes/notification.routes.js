const express = require("express");
const notificationController = require("../controllers/notification/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", notificationController.getNotifications);
router.put("/read-all", notificationController.markAllAsRead);
router.put("/:id/read", notificationController.markAsRead);
router.delete("/clear-sender/:senderId", notificationController.clearAllFromSender);
router.delete("/clear-all", notificationController.clearAllNotifications);
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
