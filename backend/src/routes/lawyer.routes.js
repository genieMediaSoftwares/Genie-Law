const express = require("express");
const lawyerController = require("../controllers/lawyer/lawyerController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", lawyerController.getAllLawyers);
router.get("/recommend", lawyerController.recommendLawyers);
router.get("/match", lawyerController.match);
router.put("/profile", lawyerController.updateLawyerProfile);
router.get("/leads", lawyerController.getLeads);
router.get("/clients", lawyerController.getClients);
router.get("/schedule/today", lawyerController.getScheduleToday);
router.get("/messages/unread", lawyerController.getUnreadMessages);
router.get("/google-calendar/status", lawyerController.getGoogleCalendarStatus);
router.post("/google-calendar/connect", lawyerController.connectGoogleCalendar);
router.post("/google-calendar/disconnect", lawyerController.disconnectGoogleCalendar);
router.get("/:id", lawyerController.getLawyerById);

module.exports = router;
