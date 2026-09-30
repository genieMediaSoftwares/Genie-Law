const User = require("../../models/User");
const Lawyer = require("../../models/Lawyer");
const Case = require("../../models/Case");
const Appointment = require("../../models/Appointment");
const Document = require("../../models/Document");
const Issue = require("../../models/Issue");
const AiConversation = require("../../models/AiConversation");
const Notification = require("../../models/Notification");
const Chat = require("../../models/Chat");
const Payment = require("../../models/Payment");
const Subscription = require("../../models/Subscription");
const Review = require("../../models/Review");
const ApiResponse = require("../../config/ApiResponse");
const AuditLog = require("../../models/AuditLog");
const { recalculateLawyerRating } = require("../../services/review/ratingService");
const paymentService = require("../../services/payment/paymentService");
const Setting = require("../../models/Setting");
const LegalDocument = require("../../models/LegalDocument");
const Category = require("../../models/Category");
const Promotion = require("../../models/Promotion");
const Referral = require("../../models/Referral");
const Milestone = require("../../models/Milestone");

// Search and filter text from the admin panel is matched literally, never as a
// regular expression (a stray "(" would otherwise fail the request).
// Fields never sent to the admin panel: credentials and third-party tokens.
const USER_PRIVATE_FIELDS = "-password -resetPasswordToken -resetPasswordExpire";
const LAWYER_PRIVATE_FIELDS = "-googleAccessToken -googleRefreshToken -googleTokenExpiry";

// Safe maximum page size for every admin listing endpoint.
const ADMIN_MAX_LIMIT = 100;

function adminPage(query, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Case.status values (models/index.js), grouped for the dashboard.
const CASE_STATUS_GROUPS = {
  awaiting: ["Submitted", "Awaiting Lawyer Acceptance", "Pending Lawyer Response", "Interested"],
  inProgress: ["Accepted", "In Progress"],
  completed: ["Completed"],
  closed: ["Closed"],
};

const URGENT_CASE_FILTER = {
  $or: [
    { urgency: { $regex: /urgent|immediate|high/i } },
    { priority: { $regex: /urgent|high/i } },
  ],
};
const realtimeEvents = require("../../realtime/events");

const logAuditAction = async (req, action, targetModel = "", targetId = "", details = {}) => {
  try {
    await AuditLog.create({
      performedBy: req.user?._id || req.user?.id,
      action,
      targetModel,
      targetId: targetId ? targetId.toString() : "",
      details,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      userAgent: req.get("User-Agent") || "",
    });
  } catch (err) {
    console.error("Failed to record audit log:", err.message);
  }
};

exports.getAdminDashboardStats = async (req, res, next) => {
  try {
    const totalClients = await User.countDocuments({ role: "client" });
    const totalLawyers = await User.countDocuments({ role: "lawyer" });
    const activeClients = await User.countDocuments({ role: "client", isActive: true });
    const inactiveClients = await User.countDocuments({ role: "client", isActive: false });

    const pendingVerifications = await Lawyer.countDocuments({ verificationStatus: "pending" });
    const approvedLawyers = await Lawyer.countDocuments({ verificationStatus: "verified" });
    const rejectedLawyers = await Lawyer.countDocuments({ verificationStatus: "rejected" });

    const totalCases = await Case.countDocuments();
    const countByStatus = (statuses) => Case.countDocuments({ status: { $in: statuses } });
    const awaitingCases = await countByStatus(CASE_STATUS_GROUPS.awaiting);
    const inProgressCases = await countByStatus(CASE_STATUS_GROUPS.inProgress);
    const completedCases = await countByStatus(CASE_STATUS_GROUPS.completed);
    const closedOnlyCases = await countByStatus(CASE_STATUS_GROUPS.closed);
    const activeCases = awaitingCases + inProgressCases;
    const closedCases = completedCases + closedOnlyCases;
    const urgentCases = await Case.countDocuments(URGENT_CASE_FILTER);

    const totalAppointments = await Appointment.countDocuments();
    const openAppointments = await Appointment.countDocuments({ status: { $ne: "Cancelled" } });

    const totalSupportTickets = await Issue.countDocuments();
    const openSupportTickets = await Issue.countDocuments({ status: { $in: ["Pending", "Assigned"] } });

    const totalDocuments = await Document.countDocuments();
    const totalAiConversations = await AiConversation.countDocuments();

    const recentRegistrations = await User.find()
      .select(USER_PRIVATE_FIELDS)
      .sort({ createdAt: -1 })
      .limit(5);

    const recentCases = await Case.find()
      .populate("client", "fullName email mobile")
      .populate("assignedLawyer", "fullName email mobile")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalClients,
        activeClients,
        inactiveClients,
        totalLawyers,
        pendingVerifications,
        approvedLawyers,
        rejectedLawyers,
        totalCases,
        activeCases,
        closedCases,
        totalAppointments,
        openAppointments,
        totalSupportTickets,
        openSupportTickets,
        totalDocuments,
        totalAiRequests: totalAiConversations,
        urgentCases,
        casesOverview: {
          pending: awaitingCases,
          inProgress: inProgressCases,
          completed: completedCases,
          closed: closedOnlyCases,
        },
        recentRegistrations,
        recentCases,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getClients = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = { role: "client" };

    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    if (search) {
      query.$or = [
        { fullName: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
        { mobile: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await User.countDocuments(query);
    const clients = await User.find(query)
      .select(USER_PRIVATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean();

    const enrichedClients = await Promise.all(
      clients.map(async (client) => {
        const id = client._id;
        const [casesCount, documentsCount, appointmentsCount] = await Promise.all([
          Case.countDocuments({ client: id }),
          Document.countDocuments({ clientId: id }),
          Appointment.countDocuments({ client: id }),
        ]);
        return { ...client, casesCount, documentsCount, appointmentsCount };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedClients.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: enrichedClients,
    });
  } catch (error) {
    next(error);
  }
};

exports.getLawyers = async (req, res, next) => {
  try {
    const { search, verificationStatus } = req.query;
    const lawyerQuery = {};

    if (verificationStatus && verificationStatus !== "all") {
      lawyerQuery.verificationStatus = verificationStatus;
    }

    let lawyers;
    let total;

    if (search) {
      // Text search: try matching by name, email, specialization or bar number
      // in MongoDB first, then finish in JS for partial matches.
      const searchRegex = new RegExp(escapeRegex(search), "i");
      const rawQuery = lawyerQuery;
      rawQuery.$or = [
        { specialization: searchRegex },
        { barCouncilNumber: searchRegex },
      ];

      const { page: pg, limit: lim, skip } = adminPage(req.query);
      total = await Lawyer.countDocuments(rawQuery);
      lawyers = await Lawyer.find(rawQuery)
        .select(LAWYER_PRIVATE_FIELDS)
        .populate("user", USER_PRIVATE_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean();
      // Final JS filter on populated user fields.
      lawyers = lawyers.filter((l) => {
        if (!l.user) return false;
        return searchRegex.test(l.user.fullName || "") ||
          searchRegex.test(l.user.email || "");
      });
    } else {
      const { page: pg, limit: lim, skip } = adminPage(req.query);
      total = await Lawyer.countDocuments(lawyerQuery);
      lawyers = await Lawyer.find(lawyerQuery)
        .select(LAWYER_PRIVATE_FIELDS)
        .populate("user", USER_PRIVATE_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim);
    }

    res.status(200).json({
      success: true,
      count: lawyers.length,
      total,
      page: Number(req.query.page) || 1,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      totalLawyers: await Lawyer.countDocuments(),
      pendingCount: await Lawyer.countDocuments({ verificationStatus: "pending" }),
      verifiedCount: await Lawyer.countDocuments({ verificationStatus: "verified" }),
      rejectedCount: await Lawyer.countDocuments({ verificationStatus: "rejected" }),
      data: lawyers,
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyLawyer = async (req, res, next) => {
  try {
    const { lawyerId } = req.params;
    const { status, rejectionReason, isActive } = req.body;

    let lawyer = await Lawyer.findById(lawyerId).populate("user");
    if (!lawyer) {
      lawyer = await Lawyer.findOne({ user: lawyerId }).populate("user");
    }
    if (!lawyer) {
      return res.status(404).json({ success: false, message: "Lawyer profile not found" });
    }

    if (status) {
      lawyer.verificationStatus = status;
      if (status === "verified") {
        await User.findByIdAndUpdate(lawyer.user._id, { isVerified: true });
      }
    }

    if (rejectionReason !== undefined) {
      lawyer.bio = rejectionReason ? `Rejection Reason: ${rejectionReason}` : lawyer.bio;
    }

    await lawyer.save();

    if (isActive !== undefined && lawyer.user) {
      await User.findByIdAndUpdate(lawyer.user._id, { isActive });
    }

    await logAuditAction(req, "verify_lawyer", "Lawyer", lawyer._id, { status, rejectionReason, isActive });

    realtimeEvents.lawyerVerificationUpdated(lawyer._id, lawyer.verificationStatus);

    res.status(200).json({
      success: true,
      message: `Lawyer status updated to ${lawyer.verificationStatus}`,
      data: lawyer,
    });
  } catch (error) {
    next(error);
  }
};

exports.getCases = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: escapeRegex(search), $options: "i" } },
        { category: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await Case.countDocuments(query);
    const cases = await Case.find(query)
      .populate("client", USER_PRIVATE_FIELDS)
      .populate("assignedLawyer", USER_PRIVATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    // Title search on populated client names stays in JS (one-tuple filter).
    let result = cases;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      result = cases.filter(
        (c) =>
          regex.test(c.title) ||
          regex.test(c.caseNumber || "") ||
          (c.client && regex.test(c.client.fullName || ""))
      );
    }

    res.status(200).json({
      success: true,
      count: result.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCaseStatus = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { status, priority } = req.body;

    const caseItem = await Case.findById(caseId);
    if (!caseItem) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    if (status) caseItem.status = status;
    if (priority) caseItem.priority = priority;

    await caseItem.save();

    res.status(200).json({
      success: true,
      message: "Case status updated successfully",
      data: caseItem,
    });
  } catch (error) {
    next(error);
  }
};

// Documents with their owner and case; search by file, client or case name.
exports.getDocuments = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const query = {};

    // "category" filters by file type: pdf, image, word, text.
    const TYPE_PATTERNS = { pdf: /pdf/i, image: /^image\//i, word: /word/i, text: /^text\//i };
    if (category && TYPE_PATTERNS[category]) {
      query.mimeType = { $regex: TYPE_PATTERNS[category] };
    }

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    let documents = await Document.find(query)
      .populate("clientId", "fullName email")
      .populate("caseId", "title status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    const total = await Document.countDocuments(query);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      documents = documents.filter(
        (doc) =>
          regex.test(doc.name || "") ||
          regex.test(doc.originalName || "") ||
          (doc.clientId && regex.test(doc.clientId.fullName)) ||
          (doc.caseId && regex.test(doc.caseId.title || ""))
      );
    }

    res.status(200).json({
      success: true,
      count: documents.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAiAnalytics = async (req, res, next) => {
  try {
    const totalConversations = await AiConversation.countDocuments();

    const conversationAggregation = await AiConversation.aggregate([
      { $group: { _id: "$title", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const topQuestions = conversationAggregation
      .filter((item) => item._id)
      .map((item) => ({ topic: item._id, count: item.count }));

    res.status(200).json({
      success: true,
      data: {
        // Only what is actually recorded: success rates, response times and
        // token usage are not tracked, so they are not reported.
        totalQuestions: totalConversations,
        topQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSupportTickets = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== "all") query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: escapeRegex(search), $options: "i" } },
        { description: { $regex: escapeRegex(search), $options: "i" } },
        { category: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await Issue.countDocuments(query);
    const tickets = await Issue.find(query)
      .populate("clientId", "fullName email mobile role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: tickets,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSupportTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const ticket = await Issue.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found" });
    }

    if (status) ticket.status = status;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Support ticket updated",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const filter = { softDelete: false };
    const [{ total }, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .populate("receiverId", "fullName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

exports.broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, targetRole } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const query = {};
    if (targetRole && targetRole !== "all") {
      query.role = targetRole;
    }

    const users = await User.find(query).select("_id");
    const notifications = users.map((u) => ({
      receiverId: u._id,
      title,
      message,
      type: "admin_broadcast",
      isRead: false,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    realtimeEvents.adminBroadcast({ title, message, targetRole });

    res.status(200).json({
      success: true,
      message: `Notification broadcasted to ${users.length} users successfully`,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAnalyticsData = async (req, res, next) => {
  try {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const monthlyStats = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = months[d.getMonth()];

      const clients = await User.countDocuments({ role: "client", createdAt: { $lt: nextD } });
      const lawyers = await User.countDocuments({ role: "lawyer", createdAt: { $lt: nextD } });
      const cases = await Case.countDocuments({ createdAt: { $lt: nextD } });

      monthlyStats.push({
        month: monthLabel,
        clients,
        lawyers,
        cases,
      });
    }

    const totalCases = await Case.countDocuments();
    const closedCases = await Case.countDocuments({ status: { $in: ["Completed", "completed", "Closed", "closed"] } });

    const caseResolutionRate = totalCases > 0 ? `${((closedCases / totalCases) * 100).toFixed(1)}%` : "0%";

    // Registrations this calendar month.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newClients = await User.countDocuments({ role: "client", createdAt: { $gte: monthStart } });
    const newLawyers = await User.countDocuments({ role: "lawyer", createdAt: { $gte: monthStart } });

    res.status(200).json({
      success: true,
      data: {
        monthlyStats,
        clientGrowthRate: `+${newClients} this month`,
        lawyerGrowthRate: `+${newLawyers} this month`,
        caseResolutionRate,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getReportData = async (req, res, next) => {
  try {
    const { reportType } = req.query;

    let headers = [];
    let rows = [];

    if (reportType === "clients") {
      headers = ["ID", "Name", "Email", "Phone", "Status", "Joined Date"];
      const clients = await User.find({ role: "client" })
        .select("_id fullName email mobile isActive createdAt")
        .sort({ createdAt: -1 })
        .lean();
      rows = clients.map((c) => [
        c._id.toString(),
        c.fullName,
        c.email,
        c.mobile,
        c.isActive ? "Active" : "Inactive",
        c.createdAt ? c.createdAt.toISOString().split("T")[0] : "N/A",
      ]);
    } else if (reportType === "lawyers") {
      headers = ["ID", "Name", "Specialization", "Experience", "Bar Number", "Status"];
      const lawyers = await Lawyer.find()
        .select("_id specialization experience barCouncilNumber verificationStatus")
        .populate("user", "_id fullName")
        .lean();
      rows = lawyers.map((l) => [
        l._id.toString(),
        l.user?.fullName || "N/A",
        l.specialization,
        `${l.experience} yrs`,
        l.barCouncilNumber || "N/A",
        l.verificationStatus,
      ]);
    } else {
      headers = ["ID", "Title", "Category", "Status", "Priority", "Created Date"];
      const cases = await Case.find()
        .select("_id title category status createdAt")
        .sort({ createdAt: -1 })
        .lean();
      rows = cases.map((cs) => [
        cs._id.toString(),
        cs.title,
        cs.category,
        cs.status,
        cs.priority || "Medium",
        cs.createdAt ? cs.createdAt.toISOString().split("T")[0] : "N/A",
      ]);
    }

    res.status(200).json({
      success: true,
      reportType,
      headers,
      rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.getClientById = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const client = await User.findOne({ _id: clientId, role: "client" }).select(USER_PRIVATE_FIELDS);
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    const cases = await Case.find({ client: clientId }).populate("assignedLawyer", "fullName email");
    const appointments = await Appointment.find({ client: clientId }).populate("lawyer", "fullName email");
    const documents = await Document.find({ clientId }).sort({ createdAt: -1 });
    const issues = await Issue.find({ clientId });
    const payments = await Payment.find({ client: clientId, status: "completed" });

    res.status(200).json({
      success: true,
      data: {
        ...client.toObject(),
        cases,
        appointments,
        documents,
        issues,
        casesCount: cases.length,
        consultationsCount: appointments.length,
        totalSpent: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateClientStatus = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { isActive } = req.body;
    const client = await User.findOneAndUpdate({ _id: clientId, role: "client" }, { isActive }, { new: true }).select(USER_PRIVATE_FIELDS);
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    await logAuditAction(req, "update_client_status", "User", clientId, { isActive });
    res.status(200).json({ success: true, message: "Client status updated successfully", data: client });
  } catch (error) {
    next(error);
  }
};

exports.getLawyerById = async (req, res, next) => {
  try {
    const { lawyerId } = req.params;
    let lawyer = await Lawyer.findById(lawyerId).select(LAWYER_PRIVATE_FIELDS).populate("user", USER_PRIVATE_FIELDS);
    if (!lawyer) {
      lawyer = await Lawyer.findOne({ user: lawyerId }).select(LAWYER_PRIVATE_FIELDS).populate("user", USER_PRIVATE_FIELDS);
    }
    if (!lawyer) {
      return res.status(404).json({ success: false, message: "Lawyer profile not found" });
    }
    const userId = lawyer.user?._id;
    const cases = userId ? await Case.find({ assignedLawyer: userId }).populate("client", "fullName email") : [];
    const appointments = userId ? await Appointment.find({ lawyer: userId }).populate("client", "fullName email") : [];
    const reviews = userId ? await Review.find({ lawyer: userId }).populate("client", "fullName email") : [];
    const subscription = userId ? await Subscription.findOne({ user: userId }).sort({ createdAt: -1 }) : null;
    const payments = userId ? await Payment.find({ lawyer: userId, status: "completed" }) : [];

    res.status(200).json({
      success: true,
      data: {
        ...lawyer.toObject(),
        cases,
        appointments,
        reviews,
        subscription,
        casesCount: cases.length,
        consultationsCount: appointments.length,
        totalEarnings: payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLawyerStatus = async (req, res, next) => {
  try {
    const { lawyerId } = req.params;
    const { isActive, verificationStatus } = req.body;

    let lawyer = await Lawyer.findById(lawyerId).populate("user");
    if (!lawyer) {
      lawyer = await Lawyer.findOne({ user: lawyerId }).populate("user");
    }
    if (!lawyer) {
      return res.status(404).json({ success: false, message: "Lawyer not found" });
    }
    if (verificationStatus) {
      lawyer.verificationStatus = verificationStatus;
      await lawyer.save();
    }
    if (isActive !== undefined && lawyer.user) {
      await User.findByIdAndUpdate(lawyer.user._id, { isActive });
    }
    await logAuditAction(req, "update_lawyer_status", "Lawyer", lawyer._id, { isActive, verificationStatus });
    res.status(200).json({ success: true, message: "Lawyer status updated successfully", data: lawyer });
  } catch (error) {
    next(error);
  }
};

exports.getCaseById = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const caseItem = await Case.findById(caseId)
      .populate("client", USER_PRIVATE_FIELDS)
      .populate("assignedLawyer", USER_PRIVATE_FIELDS)
      .populate("proposals.lawyer", "fullName email profileImage");
    if (!caseItem) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }
    const appointments = await Appointment.find({ case: caseId });
    const documents = await Document.find({ caseId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ...caseItem.toObject(),
        appointments,
        caseDocuments: documents,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;

    // When searching by name (populated field), we filter in JS on a page
    // of results. Without search, pagination is fully in MongoDB.
    const nameSearch = search && !/^(pending|confirmed|completed|cancelled)$/i.test(search);

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const countQuery = nameSearch ? {} : query;

    const total = await Appointment.countDocuments(countQuery);
    let appointments = await Appointment.find(nameSearch ? {} : query)
      .populate("client", "fullName email mobile")
      .populate("lawyer", "fullName email mobile")
      .populate("case", "title caseNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      appointments = appointments.filter(
        (a) =>
          (a.client && regex.test(a.client.fullName)) ||
          (a.lawyer && regex.test(a.lawyer.fullName)) ||
          regex.test(a.timeSlot || "") ||
          regex.test(a.status || "")
      );
    }

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;

    const nameSearch = search;
    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await Payment.countDocuments(query);

    let payments = await Payment.find(query)
      .populate("client", "fullName email mobile")
      .populate("lawyer", "fullName email mobile")
      .populate("appointment")
      .populate("case", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      payments = payments.filter(
        (p) =>
          (p.client && regex.test(p.client.fullName)) ||
          (p.lawyer && regex.test(p.lawyer.fullName)) ||
          regex.test(p.paymentMethod || "") ||
          regex.test(p.purpose || "")
      );
    }

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// Refunds go through the gateway; the backend never marks a payment refunded
// on its own. Refused while payments are disabled.
exports.processRefund = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const reason = String((req.body && req.body.reason) || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "A refund reason is required." });
    }
    const result = await paymentService.requestRefund(req.user, paymentId, reason);
    await logAuditAction(req, "process_refund", "Payment", paymentId, { reason });
    res.status(200).json({ success: true, message: "Refund requested", data: result });
  } catch (error) {
    if (error instanceof paymentService.PaymentError) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }
    next(error);
  }
};

// Payment configuration for the admin panel: mode, gateway and plan catalog.
exports.getPaymentConfig = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { ...paymentService.getStatus(), plans: paymentService.getPlans() },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSubscriptions = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;

    if (search) {
      query.$or = [
        { plan: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await Subscription.countDocuments(query);
    let subscriptions = await Subscription.find(query)
      .populate("user", "fullName email mobile role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      subscriptions = subscriptions.filter(
        (s) => regex.test(s.plan || "") || (s.user && (regex.test(s.user.fullName || "") || regex.test(s.user.email || "")))
      );
    }

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { plan, status, endDate } = req.body;

    const sub = await Subscription.findById(subscriptionId);
    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscription record not found" });
    }
    if (plan) sub.plan = plan;
    if (status) sub.status = status;
    if (endDate) sub.endDate = endDate;
    await sub.save();

    await logAuditAction(req, "update_subscription", "Subscription", subscriptionId, { plan, status });

    res.status(200).json({ success: true, message: "Subscription updated successfully", data: sub });
  } catch (error) {
    next(error);
  }
};

exports.getReviews = async (req, res, next) => {
  try {
    const { isReported, status, search } = req.query;
    const query = {};
    // status: published (visible), flagged (reported), hidden.
    if (isReported === "true" || status === "flagged") query.isReported = true;
    if (status === "hidden") query.isHidden = true;
    if (status === "published") query.isHidden = false;

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    let reviews = await Review.find(query)
      .populate("client", "fullName email profileImage")
      .populate("lawyer", "fullName email profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    const total = await Review.countDocuments(query);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      reviews = reviews.filter(
        (r) =>
          (r.client && regex.test(r.client.fullName)) ||
          (r.lawyer && regex.test(r.lawyer.fullName)) ||
          regex.test(r.review || "")
      );
    }

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateReviewVisibility = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { isHidden, isReported } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    const visibilityChanged = isHidden !== undefined && Boolean(isHidden) !== Boolean(review.isHidden);
    if (isHidden !== undefined) review.isHidden = Boolean(isHidden);
    if (isReported !== undefined) review.isReported = Boolean(isReported);
    await review.save();

    await logAuditAction(req, "update_review", "Review", reviewId, { isHidden, isReported });

    // Hidden reviews do not count toward the rating.
    const lawyerRating = visibilityChanged ? await recalculateLawyerRating(review.lawyer) : undefined;

    res.status(200).json({ success: true, message: "Review status updated", data: review, lawyerRating });
  } catch (error) {
    next(error);
  }
};

// Permanently removes a review. The audit entry keeps what was removed and why.
exports.deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const reason = String((req.body && req.body.reason) || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "A reason for removing the review is required." });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const snapshot = {
      reason,
      lawyer: review.lawyer.toString(),
      client: review.client.toString(),
      rating: review.rating,
      review: review.review,
      createdAt: review.createdAt,
    };
    await review.deleteOne();
    await logAuditAction(req, "delete_review", "Review", reviewId, snapshot);

    const lawyerRating = await recalculateLawyerRating(snapshot.lawyer);

    res.status(200).json({ success: true, message: "Review removed", data: { reviewId, lawyerRating } });
  } catch (error) {
    next(error);
  }
};

exports.getDisputes = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = { $or: [{ category: /dispute/i }, { status: "Assigned" }] };
    if (status && status !== "all") query.status = status;

    const { page: pg, limit: lim, skip } = adminPage(req.query);
    let disputes = await Issue.find(query)
      .populate("clientId", "fullName email mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    const total = await Issue.countDocuments(query);

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      disputes = disputes.filter(
        (d) => regex.test(d.title || "") || regex.test(d.description || "") || (d.clientId && regex.test(d.clientId.fullName))
      );
    }

    res.status(200).json({
      success: true,
      count: disputes.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: disputes,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUrgentCases = async (req, res, next) => {
  try {
    const urgentCases = await Case.find(URGENT_CASE_FILTER)
      .populate("client", "fullName email mobile")
      .populate("assignedLawyer", "fullName email mobile")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: urgentCases.length,
      data: urgentCases,
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    const categories = await Category.find(query).sort({ order: 1, name: 1 });
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, status, order } = req.body;
    if (!name) {
      return ApiResponse.error(res, "Category name is required.", 400);
    }
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } });
    if (existing) {
      return ApiResponse.error(res, "A category with this name already exists.", 409);
    }
    const category = await Category.create({ name, description: description || "", status: status || "active", order: order || 0 });
    await logAuditAction(req, "create_category", "Category", category._id, { name });
    res.status(201).json({ success: true, message: "Category created successfully.", data: category });
  } catch (error) {
    next(error);
  }
};

exports.getPromotions = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === "true" || isActive === true;
    }
    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await Promotion.countDocuments(query);
    const promotions = await Promotion.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);
    res.status(200).json({
      success: true,
      count: promotions.length,
      total,
      page: pg,
      pages: Math.ceil(total / Math.min(ADMIN_MAX_LIMIT, Math.max(1, Number(req.query.limit) || 20))),
      data: promotions,
    });
  } catch (error) {
    next(error);
  }
};

exports.createPromotion = async (req, res, next) => {
  try {
    const {
      name, description, code, discountType, discountValue, applicableTo,
      eligibleCategory, eligiblePlan, startDate, endDate, maxUses, maxUsesPerUser, minAmount,
    } = req.body;
    if (!name || !code || !discountType || !discountValue || !startDate || !endDate) {
      return ApiResponse.error(res, "Required fields: name, code, discountType, discountValue, startDate, endDate.", 400);
    }
    const existing = await Promotion.findOne({ code: code.toUpperCase() });
    if (existing) {
      return ApiResponse.error(res, "A promotion with this code already exists.", 409);
    }
    const promotion = await Promotion.create({
      name, description, code: code.toUpperCase(), discountType, discountValue,
      applicableTo: applicableTo || "consultation", eligibleCategory, eligiblePlan,
      startDate, endDate, maxUses: maxUses || 0, maxUsesPerUser: maxUsesPerUser || 1,
      minAmount: minAmount || 0, createdBy: req.user._id,
    });
    await logAuditAction(req, "create_promotion", "Promotion", promotion._id, { name, code });
    res.status(201).json({ success: true, message: "Promotion created successfully.", data: promotion });
  } catch (error) {
    next(error);
  }
};

exports.togglePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return ApiResponse.error(res, "Promotion not found.", 404);
    }
    promotion.isActive = !promotion.isActive;
    await promotion.save();
    await logAuditAction(req, "toggle_promotion", "Promotion", id, { isActive: promotion.isActive });
    res.status(200).json({ success: true, message: "Promotion toggled successfully.", data: promotion });
  } catch (error) {
    next(error);
  }
};

exports.getLegalDocuments = async (req, res, next) => {
  try {
    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await LegalDocument.countDocuments();
    const docs = await LegalDocument.find()
      .sort({ type: 1, createdAt: -1 })
      .skip(skip)
      .limit(lim);
    res.status(200).json({
      success: true,
      count: docs.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: docs,
    });
  } catch (error) {
    next(error);
  }
};

exports.createLegalDocument = async (req, res, next) => {
  try {
    const { type, version, title, content, effectiveDate, audience, isActive, requiresAcceptance } = req.body;
    if (isActive) {
      await LegalDocument.updateMany({ type }, { isActive: false });
    }
    const doc = await LegalDocument.create({
      type,
      version,
      title,
      content,
      effectiveDate: effectiveDate || new Date(),
      audience: audience || "all",
      isActive: isActive || false,
      requiresAcceptance: requiresAcceptance || false,
      legallyReviewed: true,
    });
    await logAuditAction(req, "create_legal_document", "LegalDocument", doc._id, { type, version, title });
    res.status(201).json({ success: true, message: "Legal document published successfully", data: doc });
  } catch (error) {
    next(error);
  }
};

exports.updateLegalDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, isActive, audience } = req.body;
    const doc = await LegalDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Legal document not found" });
    }
    if (isActive) {
      await LegalDocument.updateMany({ type: doc.type }, { isActive: false });
    }
    if (title) doc.title = title;
    if (content) doc.content = content;
    if (isActive !== undefined) doc.isActive = isActive;
    if (audience) doc.audience = audience;
    await doc.save();

    await logAuditAction(req, "update_legal_document", "LegalDocument", id, { title, isActive });
    res.status(200).json({ success: true, message: "Legal document updated successfully", data: doc });
  } catch (error) {
    next(error);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action } = req.query;
    const query = {};
    if (action && action !== "all") query.action = action;

    const { page: pg, limit: lim, skip } = adminPage(req.query, 30);
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate("performedBy", "fullName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne({ user: req.user._id });
    if (!settings) {
      settings = await Setting.create({
        user: req.user._id,
        pushNotifications: true,
        emailNotifications: true,
        darkMode: false,
        language: "English",
        twoFactorAuthentication: false,
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { pushNotifications, emailNotifications, darkMode, language, twoFactorAuthentication } = req.body;
    let settings = await Setting.findOne({ user: req.user._id });
    if (!settings) {
      settings = new Setting({ user: req.user._id });
    }
    if (pushNotifications !== undefined) settings.pushNotifications = pushNotifications;
    if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
    if (darkMode !== undefined) settings.darkMode = darkMode;
    if (language !== undefined) settings.language = language;
    if (twoFactorAuthentication !== undefined) settings.twoFactorAuthentication = twoFactorAuthentication;

    await settings.save();
    await logAuditAction(req, "update_admin_settings", "Setting", settings._id, req.body);
    res.status(200).json({ success: true, message: "Settings updated successfully", data: settings });
  } catch (error) {
    next(error);
  }
};

exports.getAllReferrals = async (req, res, next) => {
  try {
    const { page: pg, limit: lim, skip } = adminPage(req.query);
    const total = await Referral.countDocuments();
    const referrals = await Referral.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim);
    res.status(200).json({
      success: true,
      count: referrals.length,
      total,
      page: pg,
      pages: Math.ceil(total / lim),
      data: referrals,
    });
  } catch (error) {
    next(error);
  }
};

exports.getReferralStats = async (req, res, next) => {
  try {
    const totalReferrals = await Referral.countDocuments();
    const byStatus = await Referral.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byRole = await Referral.aggregate([
      { $group: { _id: "$referrerRole", count: { $sum: 1 } } },
    ]);
    res.status(200).json({
      success: true,
      data: {
        total: totalReferrals,
        byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])),
        byRole: Object.fromEntries(byRole.map((r) => [r._id, r.count])),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMilestonesByCase = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const milestones = await Milestone.find({ caseId }).sort({ order: 1, createdAt: 1 });
    res.status(200).json({ success: true, count: milestones.length, data: milestones });
  } catch (error) {
    next(error);
  }
};

