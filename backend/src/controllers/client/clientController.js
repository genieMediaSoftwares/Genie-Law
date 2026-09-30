const User = require("../../models/User");
const Client = require("../../models/Client");
const Case = require("../../models/Case");
const Appointment = require("../../models/Appointment");
const Document = require("../../models/Document");
const Payment = require("../../models/Payment");
const ApiResponse = require("../../config/ApiResponse");

const isEngagedWithClient = async (lawyerId, clientUserId) => {
  const [byCase, byAppointment] = await Promise.all([
    Case.exists({ client: clientUserId, assignedLawyer: lawyerId }),
    Appointment.exists({ client: clientUserId, lawyer: lawyerId }),
  ]);
  return Boolean(byCase || byAppointment);
};

const resolveClientForLawyer = async (user, clientUserId) => {
  if (user.role !== "lawyer" && user.role !== "admin") {
    return { error: "Access forbidden.", status: 403 };
  }

  const clientUser = await User.findById(clientUserId).select(
    "fullName email mobile profileImage location"
  );
  if (!clientUser) {
    return { error: "Client not found.", status: 404 };
  }

  if (
    user.role === "lawyer" &&
    !(await isEngagedWithClient(user._id, clientUserId))
  ) {
    return { error: "Client not found.", status: 404, notEngaged: true };
  }

  return { clientUser };
};

class ClientController {
  async getClients(req, res, next) {
    try {
      const lawyerId = req.user._id;

      const appointments = await Appointment.find({ lawyer: lawyerId }).distinct("client");
      const cases = await Case.find({ assignedLawyer: lawyerId }).distinct("client");

      const uniqueClientIds = [...new Set([...appointments, ...cases])];

      const clients = await User.find({ _id: { $in: uniqueClientIds } })
        .select("fullName email mobile profileImage location")
        .sort({ fullName: 1 });

      return ApiResponse.success(res, "Clients fetched successfully.", clients);
    } catch (error) {
      next(error);
    }
  }

  async getClientById(req, res, next) {
    try {
      const { id } = req.params;
      const lawyerId = req.user._id;

      const { clientUser, error, status, notEngaged } =
        await resolveClientForLawyer(req.user, id);
      if (notEngaged) {
        return ApiResponse.error(
          res,
          "You are not authorized to view this client.",
          403
        );
      }
      if (error) {
        return ApiResponse.error(res, error, status);
      }

      let clientProfile = await Client.findOne({ user: id });
      if (!clientProfile) {
        clientProfile = await Client.create({ user: id });
      }

      const caseHistory = await Case.find({ client: id, assignedLawyer: lawyerId });

      const documents = await Document.find({ clientId: id });

      const appointments = await Appointment.find({ client: id, lawyer: lawyerId });

      const profile = clientProfile.toObject();
      delete profile.notes;

      return ApiResponse.success(res, "Client profile retrieved.", {
        client: clientUser,
        profile,
        caseHistory,
        documents,
        appointments,
      });
    } catch (error) {
      next(error);
    }
  }

  async addNote(req, res, next) {
    try {
      const { id } = req.params;
      const { text, title, caseId } = req.body;
      const lawyerId = req.user._id;

      if (!text || !text.trim()) {
        return ApiResponse.error(res, "Note content is required.", 400);
      }

      const { error, status } = await resolveClientForLawyer(req.user, id);
      if (error) {
        return ApiResponse.error(res, error, status);
      }

      if (caseId) {
        const ownsCase = await Case.exists({
          _id: caseId,
          client: id,
          $or: [{ assignedLawyer: lawyerId }, { selectedLawyer: lawyerId }],
        });
        if (!ownsCase) {
          return ApiResponse.error(res, "Case not found.", 404);
        }
      }

      let clientProfile = await Client.findOne({ user: id });
      if (!clientProfile) {
        clientProfile = await Client.create({ user: id });
      }

      clientProfile.notes.push({
        lawyer: lawyerId,
        text: text.trim(),
        title: (title || "").trim(),
        case: caseId || null,
        date: new Date(),
        updatedAt: new Date(),
      });

      await clientProfile.save();

      const created = clientProfile.notes[clientProfile.notes.length - 1];

      return ApiResponse.success(
        res,
        "Note added to client profile successfully.",
        created,
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getNotes(req, res, next) {
    try {
      const { id } = req.params;
      const { caseId } = req.query;
      const lawyerId = req.user._id;

      const { error, status } = await resolveClientForLawyer(req.user, id);
      if (error) {
        return ApiResponse.error(res, error, status);
      }

      const clientProfile = await Client.findOne({ user: id }).populate("notes.lawyer", "fullName profileImage");
      if (!clientProfile) {
        return ApiResponse.success(res, "No client notes found.", []);
      }

      let lawyerNotes = clientProfile.notes.filter(
        (n) =>
          n.lawyer &&
          (n.lawyer._id || n.lawyer).toString() === lawyerId.toString()
      );

      if (caseId) {
        lawyerNotes = lawyerNotes.filter(
          (n) => n.case && n.case.toString() === caseId.toString()
        );
      }

      lawyerNotes = lawyerNotes.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      return ApiResponse.success(res, "Client notes fetched.", lawyerNotes);
    } catch (error) {
      next(error);
    }
  }

  async updateNote(req, res, next) {
    try {
      const { id, noteId } = req.params;
      const { text, title, caseId } = req.body;
      const lawyerId = req.user._id;

      const { error, status } = await resolveClientForLawyer(req.user, id);
      if (error) {
        return ApiResponse.error(res, error, status);
      }

      const clientProfile = await Client.findOne({ user: id });
      if (!clientProfile) {
        return ApiResponse.error(res, "Note not found.", 404);
      }

      const note = clientProfile.notes.id(noteId);
      if (
        !note ||
        !note.lawyer ||
        note.lawyer.toString() !== lawyerId.toString()
      ) {
        return ApiResponse.error(res, "Note not found.", 404);
      }

      if (text !== undefined) {
        if (!text.trim()) {
          return ApiResponse.error(res, "Note content is required.", 400);
        }
        note.text = text.trim();
      }
      if (title !== undefined) note.title = title.trim();

      if (caseId !== undefined) {
        if (caseId) {
          const ownsCase = await Case.exists({
            _id: caseId,
            client: id,
            $or: [{ assignedLawyer: lawyerId }, { selectedLawyer: lawyerId }],
          });
          if (!ownsCase) {
            return ApiResponse.error(res, "Case not found.", 404);
          }
        }
        note.case = caseId || null;
      }

      note.updatedAt = new Date();
      await clientProfile.save();

      return ApiResponse.success(res, "Note updated successfully.", note);
    } catch (error) {
      next(error);
    }
  }

  async deleteNote(req, res, next) {
    try {
      const { id, noteId } = req.params;
      const lawyerId = req.user._id;

      const { error, status } = await resolveClientForLawyer(req.user, id);
      if (error) {
        return ApiResponse.error(res, error, status);
      }

      const clientProfile = await Client.findOne({ user: id });
      if (!clientProfile) {
        return ApiResponse.error(res, "Note not found.", 404);
      }

      const note = clientProfile.notes.id(noteId);
      if (
        !note ||
        !note.lawyer ||
        note.lawyer.toString() !== lawyerId.toString()
      ) {
        return ApiResponse.error(res, "Note not found.", 404);
      }

      note.deleteOne();
      await clientProfile.save();

      return ApiResponse.success(res, "Note deleted successfully.", null);
    } catch (error) {
      next(error);
    }
  }

  async getClientProfile(req, res, next) {
    try {
      const user = await User.findById(req.user._id).select("-password");
      if (!user) {
        return ApiResponse.error(res, "User not found.", 404);
      }
      let clientProfile = await Client.findOne({ user: req.user._id });
      if (!clientProfile) {
        clientProfile = await Client.create({ user: req.user._id });
      }
      return ApiResponse.success(res, "Client profile retrieved successfully.", {
        user,
        profile: clientProfile
      });
    } catch (error) {
      next(error);
    }
  }

  async updateClientProfile(req, res, next) {
    try {
      const { fullName, mobile, location, dob, gender, languages } = req.body;
      const updateData = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (mobile !== undefined) updateData.mobile = mobile;
      if (location !== undefined) updateData.location = location;
      if (dob !== undefined) updateData.dob = dob;
      if (gender !== undefined) updateData.gender = gender;
      if (languages !== undefined) updateData.languages = languages;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true }
      ).select("-password");

      if (!user) {
        return ApiResponse.error(res, "User not found.", 404);
      }

      let clientProfile = await Client.findOne({ user: req.user._id });
      if (!clientProfile) {
        clientProfile = await Client.create({ user: req.user._id });
      }
      if (location !== undefined) clientProfile.address = location;
      if (languages !== undefined) clientProfile.preferredLanguages = languages;
      await clientProfile.save();

      return ApiResponse.success(res, "Client profile updated successfully.", {
        user,
        profile: clientProfile
      });
    } catch (error) {
      next(error);
    }
  }

  async getClientActivity(req, res, next) {
    try {
      const userId = req.user._id;
      const activities = [];

      activities.push({
        title: "Profile updated",
        description: "Personal details updated",
        date: req.user.updatedAt || req.user.createdAt || new Date(),
        type: "profile"
      });

      const documents = await Document.find({ clientId: userId }).sort({ createdAt: -1 }).limit(5);
      documents.forEach(doc => {
        activities.push({
          title: "Document uploaded",
          description: `${doc.originalName} uploaded`,
          date: doc.uploadedAt || doc.createdAt,
          type: "document"
        });
      });

      const appointments = await Appointment.find({ client: userId }).populate("lawyer", "fullName").sort({ createdAt: -1 }).limit(5);
      appointments.forEach(app => {
        activities.push({
          title: "Consultation booked",
          description: `Consultation with ${app.lawyer?.fullName || "Advocate"} booked`,
          date: app.createdAt,
          type: "consultation"
        });
      });

      const payments = await Payment.find({ client: userId }).populate("lawyer", "fullName").sort({ createdAt: -1 }).limit(5);
      payments.forEach(pay => {
        activities.push({
          title: "Payment successful",
          description: `Payment of ₹${pay.amount} completed`,
          date: pay.createdAt,
          type: "payment"
        });
      });

      activities.sort((a, b) => new Date(b.date) - new Date(a.date));

      return ApiResponse.success(res, "Client activity fetched successfully.", activities);
    } catch (error) {
      next(error);
    }
  }

  async getClientStats(req, res, next) {
    try {
      const userId = req.user._id;
      const activeCases = await Case.countDocuments({ client: userId, status: "In Progress" });
      const totalCases = await Case.countDocuments({ client: userId });
      const totalAppointments = await Appointment.countDocuments({ client: userId });
      const totalDocuments = await Document.countDocuments({ clientId: userId });

      return ApiResponse.success(res, "Client stats retrieved successfully.", {
        activeCases,
        totalCases,
        totalAppointments,
        totalDocuments
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClientController();
