const Case = require("../../models/Case");
const Lawyer = require("../../models/Lawyer");
const Proposal = require("../../models/Proposal");
const ApiResponse = require("../../config/ApiResponse");
const notificationService = require("../../services/notification/notificationService");
const caseRequestService = require("../../services/case/caseRequestService");
const realtimeEvents = require("../../realtime/events");
const caseSubmissionService = require("../../services/case/caseSubmissionService");

// ── N+1 fix: batch-fetch lawyer profiles for a list of cases ──────────────
async function attachLawyerProfiles(cases) {
  if (!cases || cases.length === 0) return;

  const ids = new Set();
  for (const c of cases) {
    if (c.selectedLawyer?._id) ids.add(c.selectedLawyer._id.toString());
    if (c.assignedLawyer?._id) ids.add(c.assignedLawyer._id.toString());
  }

  if (ids.size === 0) return;

  const profiles = await Lawyer.find({ user: { $in: [...ids] } }).lean();
  const byUserId = {};
  profiles.forEach((p) => { byUserId[p.user.toString()] = p; });

  for (const c of cases) {
    const sid = c.selectedLawyer?._id?.toString();
    if (sid && byUserId[sid]) c.selectedLawyerProfile = byUserId[sid];
    const aid = c.assignedLawyer?._id?.toString();
    if (aid && byUserId[aid]) c.assignedLawyerProfile = byUserId[aid];
  }
}
// ── end N+1 helper ────────────────────────────────────────────────────────

const partyIds = (caseItem, keys) =>
  keys
    .map((key) => caseItem[key])
    .filter(Boolean)
    .map((value) => (value._id ? value._id : value).toString());

const canReadCase = (user, caseItem) => {
  if (user.role === "admin") return true;

  const userId = user._id.toString();

  if (user.role === "client") {
    return partyIds(caseItem, ["client"]).includes(userId);
  }

  if (user.role === "lawyer") {
    if (caseItem.status === "Submitted") return true;
    const request = caseRequestService.findRequest(caseItem, userId);
    if (request && request.status === "Pending") return true;
    return partyIds(caseItem, ["assignedLawyer", "selectedLawyer"]).includes(
      userId
    );
  }

  return false;
};

const canManageHearings = (user, caseItem) => {
  if (user.role === "admin") return true;
  if (user.role !== "lawyer") return false;
  return partyIds(caseItem, ["assignedLawyer", "selectedLawyer"]).includes(
    user._id.toString()
  );
};

const syncNextHearing = (caseItem) => {
  const upcoming = (caseItem.hearings || [])
    .filter((h) => h.status === "scheduled" && h.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  caseItem.nextHearing = upcoming.length ? upcoming[0].date : null;
};

// A populated reference ({ _id, ... }) or a bare id -> the id.
const idOf = (value) => (value && value._id ? value._id : value);

// The client gets the full case; each lawyer gets the view their role allows.
const emitCaseUpdated = (req, caseItem) => {
  realtimeEvents.caseUpdated(partyIds(caseItem, ["client"]), caseItem);

  const lawyerIds = [
    ...partyIds(caseItem, ["assignedLawyer", "selectedLawyer"]),
    ...(caseItem.lawyerRequests || []).map((r) => idOf(r.lawyer).toString()),
  ];
  realtimeEvents.caseUpdated(lawyerIds, caseItem, (id) => caseRequestService.viewForLawyer(caseItem, id));
};

// Notifies the invited lawyers of a newly created case and sends the response.
// A repeated submission returns the existing case without notifying again.
const finishSubmission = async (req, res, { case: newCase, duplicate }) => {
  if (duplicate) {
    return ApiResponse.success(res, "Case already submitted.", newCase);
  }

  // The invited lawyers are notified in parallel, so the client gets its answer
  // as soon as the slowest single notification is stored.
  const lawyerIds = (newCase.lawyerRequests || []).map((r) => idOf(r.lawyer));
  await Promise.all(
    lawyerIds.map((lawyerId) =>
      notificationService.createAndSendNotification({
        senderId: newCase.client,
        receiverId: lawyerId,
        type: "case_posted",
        title: "New Case Request",
        message: `You received a direct case request: "${newCase.title}".`,
        referenceId: newCase._id.toString(),
      })
    )
  );

  emitCaseUpdated(req, newCase);

  return ApiResponse.success(res, "Case created successfully.", newCase, 201);
};

const submissionError = (res, error, next) => {
  if (error instanceof caseSubmissionService.SubmissionError) {
    if (error.code) {
      return res
        .status(error.statusCode)
        .json({ success: false, code: error.code, message: error.message });
    }
    return ApiResponse.error(res, error.message, error.statusCode);
  }
  return next(error);
};

const isEngagedLawyer = (user, caseItem) =>
  user.role === "lawyer" &&
  partyIds(caseItem, ["assignedLawyer", "selectedLawyer"]).includes(user._id.toString());

// A lawyer who has only been invited sees who the client is, not how to reach them.
const withoutClientContact = (user, caseItem) => {
  if (user.role !== "lawyer" || !caseItem || isEngagedLawyer(user, caseItem)) {
    return caseItem;
  }
  const client = caseItem.client;
  if (!client || !client._id) return caseItem;

  const plain = typeof caseItem.toObject === "function" ? caseItem.toObject() : { ...caseItem };
  plain.client = {
    _id: client._id,
    fullName: client.fullName,
    profileImage: client.profileImage,
  };
  return plain;
};

const viewForUser = (user, caseItem) =>
  user.role === "lawyer"
    ? withoutClientContact(user, caseRequestService.viewForLawyer(caseItem, user._id))
    : caseItem;

const unreadableCaseReason = (user, caseItem) => {
  if (user.role === "lawyer") {
    const request = caseRequestService.findRequest(caseItem, user._id);
    if (request) {
      const { MESSAGES } = caseRequestService;
      if (request.status === "Declined") return { status: 409, message: MESSAGES.alreadyDeclined };
      if (caseItem.assignedLawyer) return { status: 409, message: MESSAGES.takenByOther };
      return { status: 409, message: MESSAGES.noLongerAvailable };
    }
    return { status: 403, message: "You are not authorized to view this case." };
  }
  return { status: 404, message: "Case not found." };
};

class CaseController {
  // JSON case creation without documents. Document URLs sent by the client are
  // never trusted: case documents are only stored through submitCase.
  async createCase(req, res, next) {
    try {
      const { documents, ...details } = req.body || {};
      const result = await caseSubmissionService.submitCase({ user: req.user, body: details });
      return finishSubmission(req, res, result);
    } catch (error) {
      return submissionError(res, error, next);
    }
  }

  // POST /cases/submit — the single commit point of "Post Your Case".
  // multipart/form-data: `case` (JSON case details), `documents` (files),
  // `preparedDocuments` (tokens of PDFs optimized during AI analysis).
  async submitCase(req, res, next) {
    try {
      let details;
      try {
        details = typeof req.body.case === "string" ? JSON.parse(req.body.case) : req.body.case;
      } catch {
        details = null;
      }
      if (!details || typeof details !== "object" || Array.isArray(details)) {
        return ApiResponse.error(res, "The case details could not be read.", 400);
      }
      const { documents, ...caseDetails } = details;

      const result = await caseSubmissionService.submitCase({
        user: req.user,
        body: caseDetails,
        files: req.files || [],
        preparedTokens: req.body.preparedDocuments,
        verificationTokens: req.body.documentVerifications,
      });
      return finishSubmission(req, res, result);
    } catch (error) {
      return submissionError(res, error, next);
    }
  }

  async getCases(req, res, next) {
    try {
      let query = {};
      if (req.user.role === "client") {
        query.client = req.user._id;
      } else if (req.user.role === "lawyer") {
        query = {
          $or: [
            { status: "Submitted" },
            { assignedLawyer: req.user._id },
            { selectedLawyer: req.user._id },
            { lawyerRequests: { $elemMatch: { lawyer: req.user._id, status: "Pending" } } }
          ]
        };
      }

      const cases = await Case.find(query)
        .populate("client", "fullName email mobile profileImage")
        .populate("assignedLawyer", "fullName email mobile profileImage")
        .populate("selectedLawyer", "fullName email mobile profileImage isVerified")
        .populate("proposals.lawyer", "fullName email mobile profileImage")
        .sort({ createdAt: -1 })
        .lean();

      // N+1 fix: single batch fetch for lawyer profiles.
      await attachLawyerProfiles(cases);

      return ApiResponse.success(res, "Cases fetched successfully.", cases.map((c) => viewForUser(req.user, c)));
    } catch (error) {
      next(error);
    }
  }

  async getCaseById(req, res, next) {
    try {
      const { id } = req.params;
      const caseItem = await Case.findById(id)
        .populate("client", "fullName email mobile profileImage")
        .populate("assignedLawyer", "fullName email mobile profileImage")
        .populate("selectedLawyer", "fullName email mobile profileImage isVerified")
        .populate("proposals.lawyer", "fullName email mobile profileImage")
        .populate("lawyerRequests.lawyer", "fullName profileImage")
        .lean();

      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!canReadCase(req.user, caseItem)) {
        const { status, message } = unreadableCaseReason(req.user, caseItem);
        return ApiResponse.error(res, message, status);
      }

      if (caseItem.selectedLawyer) {
        const profile = await Lawyer.findOne({ user: caseItem.selectedLawyer._id }).lean();
        if (profile) {
          caseItem.selectedLawyerProfile = profile;
        }
      }

      return ApiResponse.success(res, "Case details fetched successfully.", viewForUser(req.user, caseItem));
    } catch (error) {
      next(error);
    }
  }

  async submitProposal(req, res, next) {
    try {
      const { id } = req.params;
      const { 
        feeProposal, 
        message, 
        estimatedResponseTime, 
        consultationMode, 
        availability 
      } = req.body;
      const lawyerId = req.user._id;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      const parsedFee = Number(feeProposal);
      const feeToUse = Number.isFinite(parsedFee) && parsedFee >= 0 ? parsedFee : 1500;

      let proposal = await Proposal.findOne({ caseId: id, lawyerId });
      if (proposal) {
        proposal.consultationFee = feeToUse;
        proposal.proposalMessage = message || "";
        proposal.estimatedResponseTime = estimatedResponseTime || "24 hours";
        proposal.consultationMode = consultationMode || "Video";
        proposal.availability = availability || "Mon-Fri 9AM-5PM";
        await proposal.save();
      } else {
        proposal = await Proposal.create({
          caseId: id,
          lawyerId,
          clientId: caseItem.client,
          consultationFee: feeToUse,
          proposalMessage: message || "",
          estimatedResponseTime: estimatedResponseTime || "24 hours",
          consultationMode: consultationMode || "Video",
          availability: availability || "Mon-Fri 9AM-5PM",
          status: "Pending"
        });
      }

      const existingProposalIndex = caseItem.proposals.findIndex(
        (p) => p.lawyer.toString() === lawyerId.toString()
      );

      if (existingProposalIndex > -1) {
        caseItem.proposals[existingProposalIndex].feeProposal = feeToUse;
        caseItem.proposals[existingProposalIndex].message = message || "";
      } else {
        caseItem.proposals.push({
          lawyer: lawyerId,
          feeProposal: feeToUse,
          message: message || ""
        });
      }

      caseItem.status = "Interested";

      const proposalsMilestone = caseItem.milestones.find((m) => m.title === "Proposals Received");
      if (proposalsMilestone) {
        proposalsMilestone.isCompleted = true;
      }

      await caseItem.save();

      await notificationService.createAndSendNotification({
        senderId: lawyerId,
        receiverId: caseItem.client,
        type: "proposal_received",
        title: "Proposal Received",
        message: `An advocate has sent a proposal for your case: "${caseItem.title}".`,
        referenceId: caseItem._id.toString()
      });

      realtimeEvents.caseUpdated([caseItem.client, lawyerId], caseItem);

      const updatedCase = await Case.findById(id)
        .populate("proposals.lawyer", "fullName email mobile profileImage");

      return ApiResponse.success(res, "Proposal submitted successfully.", updatedCase);
    } catch (error) {
      next(error);
    }
  }

  async acceptProposal(req, res, next) {
    try {
      const { id } = req.params;
      const { lawyerId } = req.body;

      const existing = await caseRequestService.findCaseForResponse(id);
      if (!existing || !caseRequestService.sameId(existing.client, req.user._id)) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!lawyerId || typeof lawyerId !== "string") {
        return ApiResponse.error(res, "This lawyer has not sent a proposal for this case.", 400);
      }

      const caseItem = await Case.findOneAndUpdate(
        {
          _id: id,
          client: req.user._id,
          assignedLawyer: null,
          status: { $in: caseRequestService.OPEN_STATUSES },
          "proposals.lawyer": lawyerId,
        },
        {
          $set: {
            assignedLawyer: lawyerId,
            status: "In Progress",
            "milestones.$[progress].isCompleted": true,
          },
        },
        { new: true, arrayFilters: [{ "progress.title": "In Progress" }] }
      );

      if (!caseItem) {
        if (existing.assignedLawyer) {
          return ApiResponse.error(res, caseRequestService.MESSAGES.takenByOther, 409);
        }
        return ApiResponse.error(res, "This lawyer has not sent a proposal for this case.", 400);
      }

      const Chat = require("../../models/Chat");
      let chat = await Chat.findOne({
        participants: { $all: [caseItem.client, lawyerId] }
      });
      if (!chat) {
        await Chat.create({
          participants: [caseItem.client, lawyerId],
          lastMessage: "Consultation accepted. You can now start messaging.",
          lastMessageAt: new Date()
        });
      }

      await notificationService.createAndSendNotification({
        senderId: caseItem.client,
        receiverId: lawyerId,
        type: "proposal_accepted",
        title: "Proposal Accepted",
        message: `Your proposal for the case: "${caseItem.title}" has been accepted!`,
        referenceId: caseItem._id.toString()
      });

      realtimeEvents.caseUpdated([caseItem.client, lawyerId], caseItem);

      return ApiResponse.success(res, "Proposal accepted and lawyer assigned.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async rejectProposal(req, res, next) {
    try {
      const { id } = req.params;
      const { lawyerId } = req.body;

      const caseItem = await Case.findById(id);
      if (!caseItem || !caseRequestService.sameId(caseItem.client, req.user._id)) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (caseItem.assignedLawyer) {
        return ApiResponse.error(res, caseRequestService.MESSAGES.noLongerAvailable, 409);
      }

      caseItem.status = "Rejected";
      await caseItem.save();

      await notificationService.createAndSendNotification({
        senderId: caseItem.client,
        receiverId: lawyerId,
        type: "proposal_rejected",
        title: "Proposal Rejected",
        message: `Your proposal for the case: "${caseItem.title}" has been rejected.`,
        referenceId: caseItem._id.toString()
      });

      realtimeEvents.caseUpdated([caseItem.client, lawyerId], caseItem);

      return ApiResponse.success(res, "Proposal rejected successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async updateMilestone(req, res, next) {
    try {
      const { id } = req.params;
      const { milestoneTitle, isCompleted } = req.body;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      const milestone = caseItem.milestones.find((m) => m.title === milestoneTitle);
      if (!milestone) {
        return ApiResponse.error(res, "Milestone not found.", 404);
      }

      milestone.isCompleted = isCompleted;

      if (milestoneTitle === "Closed" && isCompleted) {
        caseItem.status = "Closed";
      }

      await caseItem.save();

      const notifyUser = req.user.role === "client" ? caseItem.assignedLawyer : caseItem.client;
      if (notifyUser) {
        await notificationService.createAndSendNotification({
          senderId: req.user._id,
          receiverId: notifyUser,
          type: "case_status_updated",
          title: "Milestone Updated",
          message: `The milestone "${milestoneTitle}" has been updated for case: "${caseItem.title}".`,
          referenceId: caseItem._id.toString()
        });
      }

      realtimeEvents.caseUpdated([caseItem.client, caseItem.assignedLawyer], caseItem);

      return ApiResponse.success(res, "Milestone updated successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async acceptCaseRequest(req, res, next) {
    try {
      const lawyerId = req.user._id;

      if (req.user.role !== "lawyer") {
        return ApiResponse.error(res, caseRequestService.MESSAGES.forbidden, 403);
      }

      const outcome = await caseRequestService.acceptRequest(req.params.id, lawyerId);

      if (outcome.statusCode !== 200) {
        return ApiResponse.error(res, outcome.message, outcome.statusCode);
      }

      const caseItem = outcome.caseItem;

      if (outcome.repeated) {
        return ApiResponse.success(res, outcome.message, viewForUser(req.user, caseItem));
      }

      const Chat = require("../../models/Chat");
      let chat = await Chat.findOne({
        participants: { $all: [caseItem.client, lawyerId] }
      });
      if (!chat) {
        await Chat.create({
          participants: [caseItem.client, lawyerId],
          lastMessage: "Consultation accepted. You can now start messaging.",
          lastMessageAt: new Date()
        });
      }

      await notificationService.createAndSendNotification({
        senderId: caseItem.client,
        receiverId: lawyerId,
        type: "proposal_accepted",
        title: "Case Request Accepted",
        message: "You have accepted a new case request.",
        referenceId: caseItem._id.toString()
      });

      await notificationService.createAndSendNotification({
        senderId: lawyerId,
        receiverId: caseItem.client,
        type: "proposal_accepted",
        title: "Case Request Accepted",
        message: "Your selected lawyer has accepted your case request.",
        referenceId: caseItem._id.toString()
      });

      const unavailableFor = (caseItem.lawyerRequests || []).filter(
        (r) => r.status === "Unavailable" && !caseRequestService.sameId(r.lawyer, lawyerId)
      );
      for (const request of unavailableFor) {
        await notificationService.createAndSendNotification({
          senderId: caseItem.client,
          receiverId: request.lawyer,
          type: "case_status_updated",
          title: "Case Request Closed",
          message: caseRequestService.MESSAGES.takenByOther,
          referenceId: caseItem._id.toString()
        });
      }

      emitCaseUpdated(req, caseItem);

      return ApiResponse.success(res, outcome.message, viewForUser(req.user, caseItem));
    } catch (error) {
      next(error);
    }
  }

  async rejectCaseRequest(req, res, next) {
    try {
      const { id } = req.params;
      const lawyerId = req.user._id;

      if (req.user.role !== "lawyer") {
        return ApiResponse.error(res, caseRequestService.MESSAGES.forbidden, 403);
      }

      const existing = await caseRequestService.findCaseForResponse(id);
      if (!existing) {
        return ApiResponse.error(res, caseRequestService.MESSAGES.notFound, 404);
      }

      if (existing.lawyerRequests && existing.lawyerRequests.length > 0) {
        const outcome = await caseRequestService.declineRequest(id, lawyerId);

        if (outcome.statusCode !== 200) {
          return ApiResponse.error(res, outcome.message, outcome.statusCode);
        }

        if (!outcome.repeated) {
          await notificationService.createAndSendNotification({
            senderId: lawyerId,
            receiverId: outcome.caseItem.client,
            type: "proposal_rejected",
            title: outcome.allDeclined ? "Case Request Declined" : "Lawyer Declined",
            message: outcome.allDeclined
              ? "All the lawyers you selected have declined your case request."
              : "One of the lawyers you selected has declined your case request.",
            referenceId: outcome.caseItem._id.toString()
          });

          emitCaseUpdated(req, outcome.caseItem);
        }

        return ApiResponse.success(res, outcome.message, viewForUser(req.user, outcome.caseItem));
      }

      const caseItem = await Case.findOneAndUpdate(
        {
          _id: id,
          selectedLawyer: lawyerId,
          assignedLawyer: null,
          status: { $in: caseRequestService.OPEN_STATUSES },
        },
        { $set: { status: "Rejected" } },
        { new: true }
      );

      if (!caseItem) {
        return ApiResponse.error(res, "You are not the selected lawyer for this case.", 403);
      }

      await notificationService.createAndSendNotification({
        senderId: lawyerId,
        receiverId: caseItem.client,
        type: "proposal_rejected",
        title: "Case Request Rejected",
        message: `Your case request has been rejected by the advocate.`,
        referenceId: caseItem._id.toString()
      });

      emitCaseUpdated(req, caseItem);

      return ApiResponse.success(res, "Case request rejected.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async startCase(req, res, next) {
    try {
      const { id } = req.params;
      const lawyerId = req.user._id;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!caseItem.assignedLawyer || caseItem.assignedLawyer.toString() !== lawyerId.toString()) {
        return ApiResponse.error(res, "You are not assigned to this case.", 403);
      }

      caseItem.status = "In Progress";
      caseItem.startedAt = new Date();
      await caseItem.save();

      await notificationService.createAndSendNotification({
        senderId: caseItem.client,
        receiverId: lawyerId,
        type: "case_status_updated",
        title: "Case Started",
        message: `You have started working on case: "${caseItem.title}".`,
        referenceId: caseItem._id.toString()
      });

      await notificationService.createAndSendNotification({
        senderId: lawyerId,
        receiverId: caseItem.client,
        type: "case_status_updated",
        title: "Case Started",
        message: `Your lawyer has started working on your case: "${caseItem.title}".`,
        referenceId: caseItem._id.toString()
      });

      realtimeEvents.caseUpdated([caseItem.client, lawyerId], caseItem);

      return ApiResponse.success(res, "Case started successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async markCaseCompleted(req, res, next) {
    try {
      const { id } = req.params;
      const lawyerId = req.user._id;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!caseItem.assignedLawyer || caseItem.assignedLawyer.toString() !== lawyerId.toString()) {
        return ApiResponse.error(res, "You are not assigned to this case.", 403);
      }

      caseItem.status = "Completed";
      caseItem.completedAt = new Date();
      await caseItem.save();

      await notificationService.createAndSendNotification({
        senderId: caseItem.client,
        receiverId: lawyerId,
        type: "case_status_updated",
        title: "Case Completed",
        message: `You have marked the case as completed: "${caseItem.title}".`,
        referenceId: caseItem._id.toString()
      });

      await notificationService.createAndSendNotification({
        senderId: lawyerId,
        receiverId: caseItem.client,
        type: "case_status_updated",
        title: "Case Completed",
        message: `Your lawyer has marked your case as completed: "${caseItem.title}".`,
        referenceId: caseItem._id.toString()
      });

      realtimeEvents.caseUpdated([caseItem.client, lawyerId], caseItem);

      return ApiResponse.success(res, "Case marked completed successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async getInProgressCases(req, res, next) {
    try {
      let query = {
        status: { $in: ["Awaiting Lawyer Acceptance", "In Progress"] }
      };
      if (req.user.role === "client") {
        query.client = req.user._id;
      } else if (req.user.role === "lawyer") {
        query.$or = [
          { assignedLawyer: req.user._id },
          { selectedLawyer: req.user._id }
        ];
      }

      const cases = await Case.find(query)
        .populate("client", "fullName email mobile profileImage")
        .populate("assignedLawyer", "fullName email mobile profileImage")
        .populate("selectedLawyer", "fullName email mobile profileImage isVerified")
        .populate("proposals.lawyer", "fullName email mobile profileImage")
        .sort({ updatedAt: -1 })
        .lean();

      await attachLawyerProfiles(cases);

      return ApiResponse.success(res, "In-progress cases fetched successfully.", cases);
    } catch (error) {
      next(error);
    }
  }

  async getClosedCases(req, res, next) {
    try {
      let query = { status: { $in: ["Completed", "Closed"] } };
      if (req.user.role === "client") {
        query.client = req.user._id;
      } else if (req.user.role === "lawyer") {
        query.$or = [
          { assignedLawyer: req.user._id },
          { selectedLawyer: req.user._id }
        ];
      }

      const cases = await Case.find(query)
        .populate("client", "fullName email mobile profileImage")
        .populate("assignedLawyer", "fullName email mobile profileImage")
        .populate("selectedLawyer", "fullName email mobile profileImage isVerified")
        .populate("proposals.lawyer", "fullName email mobile profileImage")
        .sort({ updatedAt: -1 })
        .lean();

      await attachLawyerProfiles(cases);

      return ApiResponse.success(res, "Closed cases fetched successfully.", cases);
    } catch (error) {
      next(error);
    }
  }

  async getCaseTimeline(req, res, next) {
    try {
      const { id } = req.params;
      const caseItem = await Case.findById(id).select("milestones status").lean();
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }
      return ApiResponse.success(res, "Case timeline fetched successfully.", {
        status: caseItem.status,
        milestones: caseItem.milestones || []
      });
    } catch (error) {
      next(error);
    }
  }

  async getCaseLawyer(req, res, next) {
    try {
      const { id } = req.params;
      const caseItem = await Case.findById(id)
        .populate("selectedLawyer", "fullName email mobile profileImage isVerified")
        .populate("assignedLawyer", "fullName email mobile profileImage isVerified")
        .lean();

      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      const targetUser = caseItem.assignedLawyer || caseItem.selectedLawyer;
      if (!targetUser) {
        return ApiResponse.success(res, "No lawyer associated with this case.", null);
      }

      const profile = await Lawyer.findOne({ user: targetUser._id }).lean();
      return ApiResponse.success(res, "Case lawyer fetched successfully.", {
        user: targetUser,
        profile: profile || null
      });
    } catch (error) {
      next(error);
    }
  }

  async submitCaseReview(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, review } = req.body;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      // Only the client who owns the case may rate it. Without this check any
      // signed-in user could overwrite the rating on any case by id.
      if (caseItem.client.toString() !== req.user._id.toString()) {
        return ApiResponse.error(res, "You can only review your own case.", 403);
      }

      const ratingValue = Number(rating);
      if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return ApiResponse.error(res, "Rating must be between 1 and 5.", 400);
      }

      caseItem.rating = ratingValue;
      caseItem.review = review;
      await caseItem.save();

      realtimeEvents.caseUpdated([caseItem.client, caseItem.assignedLawyer], caseItem);

      return ApiResponse.success(res, "Review submitted successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async addHearing(req, res, next) {
    try {
      const { id } = req.params;
      const { date, timeSlot, court, purpose, status, notes } = req.body;

      if (!date) {
        return ApiResponse.error(res, "Hearing date is required.", 400);
      }

      const hearingDate = new Date(date);
      if (Number.isNaN(hearingDate.getTime())) {
        return ApiResponse.error(res, "Hearing date is not a valid date.", 400);
      }

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!canManageHearings(req.user, caseItem)) {
        return ApiResponse.error(
          res,
          "You are not assigned to this case.",
          403
        );
      }

      caseItem.hearings.push({
        date: hearingDate,
        timeSlot: timeSlot || "",
        court: court || caseItem.preferredCourt || "",
        purpose: purpose || "",
        status: status || "scheduled",
        notes: notes || "",
        createdBy: req.user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      syncNextHearing(caseItem);
      await caseItem.save();

      try {
        if (caseItem.client) {
          await notificationService.createAndSendNotification({
            senderId: req.user._id,
            receiverId: caseItem.client,
            type: "case_update",
            title: "Hearing Scheduled",
            message: `A hearing on "${caseItem.title}" is listed for ${hearingDate.toDateString()}.`,
            referenceId: caseItem._id.toString(),
          });
        }
      } catch (notifyError) {
        console.error(
          "⚠️ hearing notification failed:",
          notifyError.message
        );
      }

      emitCaseUpdated(req, caseItem);

      return ApiResponse.success(
        res,
        "Hearing added successfully.",
        caseItem,
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async updateHearing(req, res, next) {
    try {
      const { id, hearingId } = req.params;
      const { date, timeSlot, court, purpose, status, notes } = req.body;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!canManageHearings(req.user, caseItem)) {
        return ApiResponse.error(
          res,
          "You are not assigned to this case.",
          403
        );
      }

      const hearing = caseItem.hearings.id(hearingId);
      if (!hearing) {
        return ApiResponse.error(res, "Hearing not found.", 404);
      }

      if (date !== undefined) {
        const hearingDate = new Date(date);
        if (Number.isNaN(hearingDate.getTime())) {
          return ApiResponse.error(res, "Hearing date is not a valid date.", 400);
        }
        hearing.date = hearingDate;
      }

      if (timeSlot !== undefined) hearing.timeSlot = timeSlot;
      if (court !== undefined) hearing.court = court;
      if (purpose !== undefined) hearing.purpose = purpose;
      if (status !== undefined) hearing.status = status;
      if (notes !== undefined) hearing.notes = notes;
      hearing.updatedAt = new Date();

      syncNextHearing(caseItem);
      await caseItem.save();

      emitCaseUpdated(req, caseItem);

      return ApiResponse.success(res, "Hearing updated successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async deleteHearing(req, res, next) {
    try {
      const { id, hearingId } = req.params;

      const caseItem = await Case.findById(id);
      if (!caseItem) {
        return ApiResponse.error(res, "Case not found.", 404);
      }

      if (!canManageHearings(req.user, caseItem)) {
        return ApiResponse.error(
          res,
          "You are not assigned to this case.",
          403
        );
      }

      const hearing = caseItem.hearings.id(hearingId);
      if (!hearing) {
        return ApiResponse.error(res, "Hearing not found.", 404);
      }

      hearing.deleteOne();

      syncNextHearing(caseItem);
      await caseItem.save();

      emitCaseUpdated(req, caseItem);

      return ApiResponse.success(res, "Hearing removed successfully.", caseItem);
    } catch (error) {
      next(error);
    }
  }

  async getMyHearings(req, res, next) {
    try {
      if (req.user.role !== "lawyer") {
        return ApiResponse.error(res, "Access forbidden.", 403);
      }

      const cases = await Case.find({
        $or: [
          { assignedLawyer: req.user._id },
          { selectedLawyer: req.user._id },
        ],
        "hearings.0": { $exists: true },
      })
        .populate("client", "fullName profileImage")
        .select("title category status client hearings")
        .lean();

      const hearings = [];
      for (const caseItem of cases) {
        for (const hearing of caseItem.hearings || []) {
          hearings.push({
            ...hearing,
            caseId: caseItem._id,
            caseTitle: caseItem.title,
            caseCategory: caseItem.category,
            caseStatus: caseItem.status,
            clientId: caseItem.client ? caseItem.client._id : null,
            clientName: caseItem.client ? caseItem.client.fullName : "",
            clientImage: caseItem.client ? caseItem.client.profileImage : "",
          });
        }
      }

      hearings.sort((a, b) => new Date(a.date) - new Date(b.date));

      return ApiResponse.success(
        res,
        "Hearings fetched successfully.",
        hearings
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CaseController();
