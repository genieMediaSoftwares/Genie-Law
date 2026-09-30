const Appointment = require("../../models/Appointment");
const Case = require("../../models/Case");
const ApiResponse = require("../../config/ApiResponse");
const notificationService = require("../../services/notification/notificationService");

const ALLOWED_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

// Only the two people in the appointment (or an admin) may change it. Without
// this, any signed-in user could confirm, reschedule or cancel anyone's
// appointment by id.
const isParticipant = (user, appointment) =>
  user.role === "admin" ||
  String(appointment.client) === String(user._id) ||
  String(appointment.lawyer) === String(user._id);

class AppointmentController {
  async createAppointment(req, res, next) {
    try {
      const { lawyer, client: bodyClient, caseId, date, timeSlot, mode } = req.body;
      
      let client = req.user._id;
      let lawyerId = lawyer;

      if (req.user.role === "lawyer") {
        client = bodyClient;
        lawyerId = req.user._id;
      }

      if (!client || !lawyerId) {
        return ApiResponse.error(res, "Client and advocate are both required.", 400);
      }

      if (!date || !timeSlot) {
        return ApiResponse.error(res, "Appointment date and time slot are required.", 400);
      }

      const when = new Date(date);
      if (Number.isNaN(when.getTime())) {
        return ApiResponse.error(res, "Appointment date is not a valid date.", 400);
      }

      // The slot has to be in the future: an appointment cannot be booked for
      // a time that has already passed.
      const endOfSlotDay = new Date(when);
      endOfSlotDay.setHours(23, 59, 59, 999);
      if (endOfSlotDay.getTime() < Date.now()) {
        return ApiResponse.error(res, "That date has already passed.", 400);
      }

      // Double booking: the same advocate cannot hold two live appointments in
      // one slot, and the client cannot be in two places at once.
      const dayStart = new Date(when);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(when);
      dayEnd.setHours(23, 59, 59, 999);

      const clash = await Appointment.findOne({
        timeSlot,
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ["pending", "confirmed"] },
        $or: [{ lawyer: lawyerId }, { client }],
      });

      if (clash) {
        return ApiResponse.error(
          res,
          String(clash.lawyer) === String(lawyerId)
            ? "That time slot is already booked with this advocate."
            : "You already have an appointment in that time slot.",
          409
        );
      }

      const appointment = await Appointment.create({
        client,
        lawyer: lawyerId,
        case: caseId || null,
        date,
        timeSlot,
        mode,
        status: "confirmed"
      });

      const googleCalendarService = require("../../services/googleCalendarService");
      googleCalendarService.createOrUpdateEvent(appointment._id).catch(err => {
        console.error("Failed to sync new appointment to Google Calendar:", err);
      });

      if (caseId) {
        const caseItem = await Case.findById(caseId);
        if (caseItem) {
          const milestone = caseItem.milestones.find((m) => m.title === "Consultation Scheduled");
          if (milestone) {
            milestone.isCompleted = true;
          }
          await caseItem.save();
        }
      }

      await notificationService.createAndSendNotification({
        senderId: req.user._id,
        receiverId: client,
        type: "appointment_requested",
        title: "Appointment Booked",
        message: `Your appointment has been scheduled for ${date} at ${timeSlot}.`,
        referenceId: appointment._id.toString()
      });

      await notificationService.createAndSendNotification({
        senderId: req.user._id,
        receiverId: lawyerId,
        type: "appointment_requested",
        title: "New Appointment Scheduled",
        message: `An appointment has been scheduled for ${date} at ${timeSlot}.`,
        referenceId: appointment._id.toString()
      });

      return ApiResponse.success(res, "Appointment booked successfully.", appointment, 201);
    } catch (error) {
      next(error);
    }
  }

  async getAppointments(req, res, next) {
    try {
      let query = {};
      if (req.user.role === "client") {
        query.client = req.user._id;
      } else if (req.user.role === "lawyer") {
        query.lawyer = req.user._id;
      }

      const appointments = await Appointment.find(query)
        .populate("client", "fullName email mobile profileImage")
        .populate("lawyer", "fullName email mobile profileImage")
        .populate("case", "title category")
        .sort({ date: 1, timeSlot: 1 });

      return ApiResponse.success(res, "Appointments fetched successfully.", appointments);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const appointment = await Appointment.findById(id);
      if (!appointment) {
        return ApiResponse.error(res, "Appointment not found.", 404);
      }

      if (!isParticipant(req.user, appointment)) {
        return ApiResponse.error(res, "You cannot change this appointment.", 403);
      }

      if (!ALLOWED_STATUSES.includes(status)) {
        return ApiResponse.error(res, "That appointment status is not valid.", 400);
      }

      appointment.status = status;
      await appointment.save();

      const googleCalendarService = require("../../services/googleCalendarService");
      if (status === "cancelled") {
        googleCalendarService.deleteEvent(appointment._id).catch(err => {
          console.error("Failed to delete Google Calendar event:", err);
        });
      } else {
        googleCalendarService.createOrUpdateEvent(appointment._id).catch(err => {
          console.error("Failed to update Google Calendar event:", err);
        });
      }

      const notifyUser = req.user.role === "client" ? appointment.lawyer : appointment.client;
      await notificationService.createAndSendNotification({
        senderId: req.user._id,
        receiverId: notifyUser,
        type: status === "confirmed" ? "appointment_confirmed" : (status === "cancelled" ? "appointment_cancelled" : "general"),
        title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your appointment on ${appointment.date} has been ${status}.`,
        referenceId: appointment._id.toString()
      });

      return ApiResponse.success(res, `Appointment status updated to ${status}.`, appointment);
    } catch (error) {
      next(error);
    }
  }

  async updateAppointment(req, res, next) {
    try {
      const { id } = req.params;

      const existing = await Appointment.findById(id);
      if (!existing) {
        return ApiResponse.error(res, "Appointment not found.", 404);
      }

      if (!isParticipant(req.user, existing)) {
        return ApiResponse.error(res, "You cannot change this appointment.", 403);
      }

      // Only reschedulable details may be changed. Taking req.body wholesale
      // let a caller reassign the appointment's client or lawyer.
      const updates = {};
      for (const field of ["date", "timeSlot", "mode", "notes", "meetingLink"]) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const appointment = await Appointment.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

      const googleCalendarService = require("../../services/googleCalendarService");
      googleCalendarService.createOrUpdateEvent(appointment._id).catch(err => {
        console.error("Failed to update Google Calendar event on reschedule:", err);
      });

      return ApiResponse.success(res, "Appointment updated successfully.", appointment);
    } catch (error) {
      next(error);
    }
  }

  async deleteAppointment(req, res, next) {
    try {
      const { id } = req.params;
      const appointment = await Appointment.findById(id);
      if (!appointment) {
        return ApiResponse.error(res, "Appointment not found.", 404);
      }

      if (!isParticipant(req.user, appointment)) {
        return ApiResponse.error(res, "You cannot cancel this appointment.", 403);
      }

      appointment.status = "cancelled";
      await appointment.save();

      const googleCalendarService = require("../../services/googleCalendarService");
      googleCalendarService.deleteEvent(appointment._id).catch(err => {
        console.error("Failed to delete Google Calendar event on delete:", err);
      });

      const notifyUser = req.user._id.toString() === appointment.client.toString() ? appointment.lawyer : appointment.client;
      await notificationService.createAndSendNotification({
        senderId: req.user._id,
        receiverId: notifyUser,
        type: "appointment_cancelled",
        title: "Appointment Cancelled",
        message: `Your appointment scheduled on ${appointment.date} has been cancelled.`,
        referenceId: appointment._id.toString()
      });

      return ApiResponse.success(res, "Appointment cancelled successfully.", appointment);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AppointmentController();
