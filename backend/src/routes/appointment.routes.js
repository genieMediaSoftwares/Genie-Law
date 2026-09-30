const express = require("express");
const appointmentController = require("../controllers/appointment/appointmentController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", appointmentController.createAppointment);
router.get("/", appointmentController.getAppointments);
router.put("/:id/status", appointmentController.updateStatus);
router.put("/:id", appointmentController.updateAppointment);
router.delete("/:id", appointmentController.deleteAppointment);

module.exports = router;
