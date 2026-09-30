const Lawyer = require("../../models/Lawyer");
const User = require("../../models/User");
const ApiResponse = require("../../config/ApiResponse");
const { required } = require("../../config/env");

const UNAVAILABLE_LEAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

class LawyerController {
  async getAllLawyers(req, res, next) {
    try {
      const {
        search,
        specialization,
        location,
        experience,
        minFee,
        maxFee,
        rating,
        language,
        verifiedOnly,
        availableNow,
        sortBy
      } = req.query;

      let userQuery = { role: "lawyer" };

      if (search) {
        userQuery.fullName = { $regex: search, $options: "i" };
      }
      if (location && location !== "All" && location !== "All Locations") {
        userQuery.location = { $regex: location, $options: "i" };
      }
      if (verifiedOnly === "true") {
        userQuery.isVerified = true;
      }
      if (availableNow === "true") {
        userQuery.isActive = true;
      }

      const matchingUsers = await User.find(userQuery);
      const userIds = matchingUsers.map((u) => u._id);

      const existingLawyers = await Lawyer.find({ user: { $in: userIds } }).populate(
        "user",
        "fullName email mobile profileImage location isVerified isActive"
      );

      const existingUserIds = new Set(existingLawyers.map((l) => l.user ? l.user._id.toString() : ''));
      const missingUsers = matchingUsers.filter((u) => !existingUserIds.has(u._id.toString()));

      if (missingUsers.length > 0) {
        const newLawyerPromises = missingUsers.map((user) => 
          Lawyer.create({
            user: user._id,
            specialization: "General Practice",
            experience: 2,
            education: "LLB",
            consultationFee: 1500,
            bio: "Professional advocate specializing in litigation and advisory.",
            languages: ["English", "Hindi"],
            barCouncilNumber: "12345/2026",
            officeAddress: user.location || "Office Address",
          })
        );
        await Promise.all(newLawyerPromises);
      }

      let lawyerQuery = { user: { $in: userIds } };
      
      if (specialization && specialization !== "All" && specialization !== "All Practice Areas") {
        lawyerQuery.specialization = { $regex: specialization, $options: "i" };
      }

      if (experience && experience !== "All" && experience !== "All Experience") {
        if (experience === "0-2") {
          lawyerQuery.experience = { $gte: 0, $lte: 2 };
        } else if (experience === "3-5") {
          lawyerQuery.experience = { $gte: 3, $lte: 5 };
        } else if (experience === "5-10") {
          lawyerQuery.experience = { $gte: 5, $lte: 10 };
        } else if (experience === "10+") {
          lawyerQuery.experience = { $gte: 10 };
        }
      }

      if (minFee || maxFee) {
        lawyerQuery.consultationFee = {};
        if (minFee) {
          lawyerQuery.consultationFee.$gte = parseInt(minFee);
        }
        if (maxFee) {
          lawyerQuery.consultationFee.$lte = parseInt(maxFee);
        }
      }

      if (rating && rating !== "All" && rating !== "All Ratings") {
        const parsedRating = parseFloat(rating.replace("★+", "").replace("+", ""));
        if (!isNaN(parsedRating)) {
          lawyerQuery.rating = { $gte: parsedRating };
        }
      }

      if (language) {
        const langs = Array.isArray(language) ? language : [language];
        const cleanLangs = langs.filter(l => l && l.trim() !== "");
        if (cleanLangs.length > 0) {
          lawyerQuery.languages = { $in: cleanLangs.map(l => new RegExp(l.trim(), 'i')) };
        }
      }

      let lawyers = await Lawyer.find(lawyerQuery).populate(
        "user",
        "fullName email mobile profileImage location isVerified isActive"
      );

      if (sortBy) {
        if (sortBy === "Highest Rated") {
          lawyers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (sortBy === "Most Reviewed") {
          lawyers.sort((a, b) => (b.totalReviews || 0) - (a.totalReviews || 0));
        } else if (sortBy === "Name (A - Z)") {
          lawyers.sort((a, b) => {
            const nameA = (a.user && a.user.fullName || '').toLowerCase();
            const nameB = (b.user && b.user.fullName || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
        } else if (sortBy === "Name (Z - A)") {
          lawyers.sort((a, b) => {
            const nameA = (a.user && a.user.fullName || '').toLowerCase();
            const nameB = (b.user && b.user.fullName || '').toLowerCase();
            return nameB.localeCompare(nameA);
          });
        } else if (sortBy === "Newest First") {
          lawyers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
      }

      return ApiResponse.success(res, "Lawyers fetched successfully.", lawyers);
    } catch (error) {
      next(error);
    }
  }

  async getLawyerById(req, res, next) {
    try {
      const { id } = req.params;
      let lawyer = await Lawyer.findOne({ user: id }).populate(
        "user",
        "fullName email mobile profileImage location"
      );

      if (!lawyer) {
        lawyer = await Lawyer.findById(id).populate(
          "user",
          "fullName email mobile profileImage location"
        );
      }

      if (!lawyer) {
        const user = await User.findById(id);
        if (user && user.role === 'lawyer') {
          lawyer = await Lawyer.create({
            user: id,
            specialization: "General Practice",
            experience: 0,
            education: "",
            consultationFee: 0,
            bio: "",
            languages: []
          });
          lawyer = await Lawyer.findById(lawyer._id).populate(
            "user",
            "fullName email mobile profileImage location"
          );
        }
      }

      if (!lawyer) {
        return ApiResponse.error(res, "Lawyer profile not found.", 404);
      }

      return ApiResponse.success(res, "Lawyer details fetched successfully.", lawyer);
    } catch (error) {
      next(error);
    }
  }

  async updateLawyerProfile(req, res, next) {
    try {
      const userId = req.user._id;
      const {
        specialization,
        experience,
        education,
        barCouncilNumber,
        consultationFee,
        bio,
        officeAddress,
        upiId,
        workingHours,
        bankDetails,
      } = req.body;
      
      let lawyer = await Lawyer.findOneAndUpdate(
        { user: userId },
        {
          specialization,
          experience,
          education,
          barCouncilNumber,
          consultationFee,
          bio,
          officeAddress,
          upiId,
          workingHours,
          bankDetails,
        },
        { new: true, runValidators: true }
      ).populate("user", "fullName email mobile profileImage location");

      if (!lawyer) {
        return ApiResponse.error(res, "Lawyer profile not found.", 404);
      }

      return ApiResponse.success(res, "Lawyer profile updated successfully.", lawyer);
    } catch (error) {
      next(error);
    }
  }
  async match(req, res, next) {
    try {
      const { specialization, experience, maxFee, rating, language } = req.query;
      let userQuery = { role: "lawyer" };
      const matchingUsers = await User.find(userQuery).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      let lawyerQuery = { user: { $in: userIds } };
      
      if (specialization && specialization !== "All") {
        lawyerQuery.specialization = { $regex: specialization, $options: "i" };
      }
      if (experience) {
        lawyerQuery.experience = { $gte: parseInt(experience) };
      }
      if (maxFee) {
        lawyerQuery.consultationFee = { $lte: parseInt(maxFee) };
      }
      if (rating) {
        lawyerQuery.rating = { $gte: parseFloat(rating) };
      }
      if (language) {
        lawyerQuery.languages = { $regex: language, $options: "i" };
      }

      const lawyers = await Lawyer.find(lawyerQuery).populate(
        "user",
        "fullName email mobile profileImage location"
      );

      return ApiResponse.success(res, "Matched lawyers fetched successfully.", lawyers);
    } catch (error) {
      next(error);
    }
  }

  async recommendLawyers(req, res, next) {
    try {
      const { category, subcategory, city, district, state, sortBy, limit } = req.query;

      if (!category) {
        return ApiResponse.error(res, "Category is required for recommendation.", 400);
      }

      const lawyerRecommendationService = require("../../services/lawyer/lawyerRecommendationService");
      const results = await lawyerRecommendationService.getRecommendations({
        category,
        subcategory,
        city,
        district,
        state,
        sortBy,
        limit: limit ? parseInt(limit) : 10,
      });

      return ApiResponse.success(res, "Recommended lawyers fetched successfully.", results);
    } catch (error) {
      next(error);
    }
  }

  async getLeads(req, res, next) {
    try {
      const Case = require("../../models/Case");
      const caseRequestService = require("../../services/case/caseRequestService");
      const recentlyClosed = new Date(Date.now() - UNAVAILABLE_LEAD_WINDOW_MS);
      const leads = await Case.find({
        $or: [
          { selectedLawyer: req.user._id, assignedLawyer: null, status: { $in: ["Awaiting Lawyer Acceptance", "Pending Lawyer Response"] } },
          { status: "Submitted", selectedLawyer: null },
          { lawyerRequests: { $elemMatch: { lawyer: req.user._id, status: "Pending" } } },
          { lawyerRequests: { $elemMatch: { lawyer: req.user._id, status: "Unavailable", respondedAt: { $gte: recentlyClosed } } } }
        ]
      })
        .populate("client", "fullName profileImage")
        .sort({ createdAt: -1 });

      const formattedLeads = leads.map(c => {
        const request = caseRequestService.findRequest(c, req.user._id);
        const requestStatus = request ? request.status : "Pending";
        const isAvailable = requestStatus === "Pending";

        return {
          caseId: c._id,
          clientName: isAvailable && c.client ? c.client.fullName : isAvailable ? "Unknown Client" : "Client",
          clientProfileImage: isAvailable && c.client ? c.client.profileImage : "",
          issueCategory: c.category,
          issueTitle: c.title,
          location: isAvailable ? c.location : "",
          postedTime: c.createdAt,
          urgency: c.urgency,
          documentsCount: isAvailable ? (c.documents || []).length : 0,
          acknowledgementDocument: isAvailable && c.documents && c.documents[0] ? c.documents[0].url : "",
          preferredCourt: isAvailable ? c.preferredCourt : "",
          caseStatus: c.status,
          requestStatus,
          unavailableReason: requestStatus === "Unavailable" ? caseRequestService.MESSAGES.takenByOther : null,
        };
      });

      return ApiResponse.success(res, "Leads retrieved successfully.", formattedLeads);
    } catch (error) {
      next(error);
    }
  }

  async getClients(req, res, next) {
    try {
      const Case = require("../../models/Case");
      const cases = await Case.find({
        assignedLawyer: req.user._id
      })
        .populate("client", "fullName profileImage")
        .sort({ updatedAt: -1 });

      const mapClient = (c) => ({
        clientId: c.client ? c.client._id : "",
        name: c.client ? c.client.fullName : "Unknown Client",
        caseId: c._id,
        issue: c.title,
        category: c.category || "",
        location: c.location || c.locationCity || "",
        preferredCourt: c.preferredCourt || "",
        urgency: c.urgency || "",
        currentStatus: c.status,
        acceptedAt: c.acceptedAt || null,
        lastActivity: c.updatedAt,
        profileImage: c.client ? c.client.profileImage : "",
      });

      const accepted = cases.filter(c => ["Accepted", "Awaiting Lawyer Acceptance", "Submitted"].includes(c.status)).map(mapClient);
      const inProgress = cases.filter(c => c.status === "In Progress").map(mapClient);
      const closed = cases.filter(c => ["Completed", "Closed"].includes(c.status)).map(mapClient);

      return ApiResponse.success(res, "Clients fetched and grouped successfully.", {
        accepted,
        inProgress,
        closed
      });
    } catch (error) {
      next(error);
    }
  }

  async getScheduleToday(req, res, next) {
    try {
      const Appointment = require("../../models/Appointment");
      const CalendarEvent = require("../../models/CalendarEvent");
      const Case = require("../../models/Case");

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const appointments = await Appointment.find({
        lawyer: req.user._id,
        date: { $gte: startOfToday, $lte: endOfToday }
      }).populate("client", "fullName").populate("case", "title");

      const casesWithHearings = await Case.find({
        assignedLawyer: req.user._id,
        nextHearing: { $gte: startOfToday, $lte: endOfToday }
      }).populate("client", "fullName");

      const calendarEvents = await CalendarEvent.find({
        lawyer: req.user._id,
        date: { $gte: startOfToday, $lte: endOfToday }
      });

      const apptEvents = appointments.map(a => ({
        title: `Consultation with ${a.client ? a.client.fullName : "Client"}`,
        client: a.client ? a.client.fullName : "",
        case: a.case ? a.case.title : "",
        startTime: a.date,
        endTime: new Date(a.date.getTime() + 30 * 60000),
        eventType: "consultation"
      }));

      const hearingEvents = casesWithHearings.map(c => ({
        title: `Court Hearing: ${c.title}`,
        client: c.client ? c.client.fullName : "",
        case: c.title,
        startTime: c.nextHearing,
        endTime: new Date(c.nextHearing.getTime() + 60 * 60000),
        eventType: "hearing"
      }));

      const calEvents = calendarEvents.map(e => ({
        title: e.title,
        client: "",
        case: "",
        startTime: e.date,
        endTime: e.date,
        eventType: e.type === "personal_event" ? "meeting" : "reminder"
      }));

      const allEvents = [...apptEvents, ...hearingEvents, ...calEvents];
      allEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      return ApiResponse.success(res, "Today's schedule fetched successfully.", allEvents);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadMessages(req, res, next) {
    try {
      const Chat = require("../../models/Chat");
      const Message = require("../../models/Message");

      const chats = await Chat.find({
        participants: req.user._id
      }).populate("participants", "fullName");

      let unreadCount = 0;
      let latestMessage = "";
      let latestClient = "";
      let lastMessageTime = null;
      let conversationCount = chats.length;

      if (chats.length > 0) {
        const chatIds = chats.map(c => c._id);
        
        unreadCount = await Message.countDocuments({
          chat: { $in: chatIds },
          isRead: false,
          sender: { $ne: req.user._id }
        });

        const lastMsg = await Message.findOne({
          chat: { $in: chatIds }
        }).sort({ createdAt: -1 }).populate("sender", "fullName");

        if (lastMsg) {
          latestMessage = lastMsg.content;
          lastMessageTime = lastMsg.createdAt;
          
          const chatDetail = chats.find(c => c._id.toString() === lastMsg.chat.toString());
          if (chatDetail) {
            const clientPart = chatDetail.participants.find(p => p._id.toString() !== req.user._id.toString());
            latestClient = clientPart ? clientPart.fullName : (lastMsg.sender ? lastMsg.sender.fullName : "");
          }
        }
      }

      return ApiResponse.success(res, "Unread messages count fetched.", {
        unreadCount,
        conversationCount,
        latestMessage,
        latestClient,
        lastMessageTime
      });
    } catch (error) {
      next(error);
    }
  }

  async getGoogleCalendarStatus(req, res, next) {
    try {
      const Lawyer = require("../../models/Lawyer");
      const lawyer = await Lawyer.findOne({ user: req.user._id });
      if (!lawyer) {
        return ApiResponse.error(res, "Lawyer profile not found.", 404);
      }
      return ApiResponse.success(res, "Google Calendar status retrieved.", {
        connected: lawyer.googleConnected || false,
        email: lawyer.googleEmail || "",
      });
    } catch (error) {
      next(error);
    }
  }

  async connectGoogleCalendar(req, res, next) {
    try {
      const { email, isSimulated, code } = req.body;
      const Lawyer = require("../../models/Lawyer");
      const lawyer = await Lawyer.findOne({ user: req.user._id });
      if (!lawyer) {
        return ApiResponse.error(res, "Lawyer profile not found.", 404);
      }

      const googleCalendarService = require("../../services/googleCalendarService");

      const realMode =
        googleCalendarService.isRealMode() && !isSimulated && Boolean(code);

      if (realMode) {
        const { google } = require("googleapis");
        const oauth2Client = new google.auth.OAuth2(
          required("GOOGLE_CLIENT_ID"),
          required("GOOGLE_CLIENT_SECRET"),
          required("GOOGLE_REDIRECT_URI")
        );
        
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        lawyer.googleConnected = true;
        lawyer.googleEmail = userInfo.data.email || email;
        lawyer.googleAccessToken = tokens.access_token;
        if (tokens.refresh_token) {
          lawyer.googleRefreshToken = tokens.refresh_token;
        }
        if (tokens.expiry_date) {
          lawyer.googleTokenExpiry = new Date(tokens.expiry_date);
        }
      } else {
        if (!email) {
          return ApiResponse.error(
            res,
            "An email address is required to connect a calendar.",
            400
          );
        }

        lawyer.googleConnected = true;
        lawyer.googleEmail = email;
        lawyer.googleAccessToken = "";
        lawyer.googleRefreshToken = "mock_refresh_token";
        lawyer.googleTokenExpiry = null;
      }

      await lawyer.save();

      googleCalendarService.syncExistingAppointments(req.user._id).catch(err => {
        console.error("Failed to sync existing appointments on connect:", err);
      });

      return ApiResponse.success(
        res,
        realMode
          ? "Google Calendar connected successfully."
          : "Calendar linked in simulation mode — consultations will not appear in your real Google Calendar until Google credentials are configured.",
        {
          connected: true,
          email: lawyer.googleEmail,
          simulated: !realMode,
        }
      );
    } catch (error) {
      next(error);
    }
  }

  async disconnectGoogleCalendar(req, res, next) {
    try {
      const Lawyer = require("../../models/Lawyer");
      const lawyer = await Lawyer.findOne({ user: req.user._id });
      if (!lawyer) {
        return ApiResponse.error(res, "Lawyer profile not found.", 404);
      }

      lawyer.googleConnected = false;
      lawyer.googleEmail = "";
      lawyer.googleAccessToken = "";
      lawyer.googleRefreshToken = "";
      lawyer.googleTokenExpiry = null;

      await lawyer.save();

      return ApiResponse.success(res, "Google Calendar disconnected successfully.", {
        connected: false,
        email: "",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LawyerController();
