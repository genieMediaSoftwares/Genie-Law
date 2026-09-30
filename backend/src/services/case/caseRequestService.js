const Case = require("../../models/Case");
const User = require("../../models/User");

const { REQUIRED_LAWYER_COUNT } = Case;

const OPEN_STATUSES = [
  "Submitted",
  "Awaiting Lawyer Acceptance",
  "Pending Lawyer Response",
  "Interested",
];

const MESSAGES = {
  wrongCount: `Exactly ${REQUIRED_LAWYER_COUNT} lawyers must be selected.`,
  duplicate: "The same lawyer cannot be selected more than once.",
  invalidLawyer: "One or more selected lawyers are not available.",
  notFound: "Case request not found.",
  forbidden: "You are not authorized to respond to this case request.",
  takenByOther: "This case has already been accepted by another lawyer.",
  alreadyAccepted: "You have already accepted this case.",
  alreadyDeclined: "You have already declined this case request.",
  noLongerAvailable: "This case request is no longer available.",
};

const idOf = (value) => (value && value._id ? value._id : value);
const sameId = (a, b) => Boolean(a && b) && idOf(a).toString() === idOf(b).toString();

const result = (statusCode, message, caseItem = null) => ({ statusCode, message, caseItem });

const findRequest = (caseItem, lawyerId) =>
  (caseItem.lawyerRequests || []).find((r) => sameId(r.lawyer, lawyerId));

async function validateSelectedLawyers(clientId, selectedLawyers) {
  if (!Array.isArray(selectedLawyers) || selectedLawyers.length !== REQUIRED_LAWYER_COUNT) {
    return { error: MESSAGES.wrongCount };
  }

  const ids = selectedLawyers.map((value) => String(value ?? "").trim());

  if (ids.some((id) => !id || typeof id !== "string")) {
    return { error: MESSAGES.invalidLawyer };
  }

  if (new Set(ids).size !== ids.length) {
    return { error: MESSAGES.duplicate };
  }

  if (ids.includes(clientId.toString())) {
    return { error: MESSAGES.invalidLawyer };
  }

  const found = await User.countDocuments({
    _id: { $in: ids },
    role: "lawyer",
    isActive: { $ne: false },
  });

  if (found !== ids.length) {
    return { error: MESSAGES.invalidLawyer };
  }

  return { lawyerIds: ids };
}

function explainFailedResponse(caseItem, lawyerId) {
  if (!caseItem) return result(404, MESSAGES.notFound);

  if (sameId(caseItem.assignedLawyer, lawyerId)) {
    return { ...result(200, MESSAGES.alreadyAccepted, caseItem), repeated: true };
  }

  const request = findRequest(caseItem, lawyerId);

  if (caseItem.lawyerRequests && caseItem.lawyerRequests.length > 0) {
    if (!request) return result(403, MESSAGES.forbidden);
    if (request.status === "Declined") return result(409, MESSAGES.alreadyDeclined);
  } else if (caseItem.selectedLawyer && !sameId(caseItem.selectedLawyer, lawyerId)) {
    return result(403, MESSAGES.forbidden);
  }

  if (caseItem.assignedLawyer) return result(409, MESSAGES.takenByOther);

  return result(409, MESSAGES.noLongerAvailable);
}

async function acceptRequest(caseId, lawyerId) {
  if (!caseId || typeof caseId !== "string") return result(404, MESSAGES.notFound);

  const existing = await Case.findById(caseId).select("lawyerRequests selectedLawyer assignedLawyer status").lean();
  if (!existing) return result(404, MESSAGES.notFound);

  const now = new Date();
  const isInvitation = existing.lawyerRequests && existing.lawyerRequests.length > 0;

  const filter = {
    _id: caseId,
    assignedLawyer: null,
    status: { $in: OPEN_STATUSES },
  };

  const set = {
    assignedLawyer: lawyerId,
    selectedLawyer: lawyerId,
    status: "Accepted",
    acceptedAt: now,
    "milestones.$[progress].isCompleted": true,
  };

  const arrayFilters = [{ "progress.title": "In Progress" }];

  if (isInvitation) {
    filter.lawyerRequests = { $elemMatch: { lawyer: lawyerId, status: "Pending" } };
    Object.assign(set, {
      "lawyerRequests.$[mine].status": "Accepted",
      "lawyerRequests.$[mine].respondedAt": now,
      "lawyerRequests.$[mine].acceptedAt": now,
      "lawyerRequests.$[other].status": "Unavailable",
      "lawyerRequests.$[other].respondedAt": now,
    });
    arrayFilters.push(
      { "mine.lawyer": lawyerId },
      { "other.lawyer": { $ne: lawyerId }, "other.status": "Pending" }
    );
  } else {
    filter.$or = [
      { selectedLawyer: lawyerId },
      { selectedLawyer: null, status: "Submitted" },
    ];
  }

  const accepted = await Case.findOneAndUpdate(filter, { $set: set }, { new: true, arrayFilters });

  if (accepted) return result(200, "Case request accepted and lawyer assigned.", accepted);

  const current = await Case.findById(caseId).lean();
  return explainFailedResponse(current, lawyerId);
}

async function declineRequest(caseId, lawyerId) {
  if (!caseId || typeof caseId !== "string") return result(404, MESSAGES.notFound);

  const now = new Date();

  const declined = await Case.findOneAndUpdate(
    {
      _id: caseId,
      assignedLawyer: null,
      status: { $in: OPEN_STATUSES },
      lawyerRequests: { $elemMatch: { lawyer: lawyerId, status: "Pending" } },
    },
    {
      $set: {
        "lawyerRequests.$[mine].status": "Declined",
        "lawyerRequests.$[mine].respondedAt": now,
      },
    },
    { new: true, arrayFilters: [{ "mine.lawyer": lawyerId }] }
  );

  if (!declined) {
    const current = await Case.findById(caseId).lean();
    const request = current ? findRequest(current, lawyerId) : null;
    if (request && request.status === "Declined") {
      return { ...result(200, MESSAGES.alreadyDeclined, current), allDeclined: false, repeated: true };
    }
    if (current && sameId(current.assignedLawyer, lawyerId)) {
      return result(409, MESSAGES.alreadyAccepted);
    }
    return explainFailedResponse(current, lawyerId);
  }

  const closed = await Case.findOneAndUpdate(
    {
      _id: caseId,
      assignedLawyer: null,
      status: { $in: OPEN_STATUSES },
      lawyerRequests: { $not: { $elemMatch: { status: { $ne: "Declined" } } } },
    },
    { $set: { status: "Rejected" } },
    { new: true }
  );

  return {
    ...result(200, "Case request declined.", closed || declined),
    allDeclined: Boolean(closed),
  };
}

async function findCaseForResponse(caseId) {
  if (!caseId || typeof caseId !== "string") return null;
  return Case.findById(caseId).select("lawyerRequests selectedLawyer assignedLawyer status client").lean();
}

function viewForLawyer(caseItem, lawyerId) {
  if (!caseItem || !Array.isArray(caseItem.lawyerRequests) || caseItem.lawyerRequests.length === 0) {
    return caseItem;
  }
  const plain = typeof caseItem.toObject === "function" ? caseItem.toObject() : { ...caseItem };
  const mine = findRequest(plain, lawyerId);
  plain.lawyerRequests = mine ? [mine] : [];
  plain.myRequestStatus = mine ? mine.status : null;
  return plain;
}

module.exports = {
  OPEN_STATUSES,
  MESSAGES,
  REQUIRED_LAWYER_COUNT,
  validateSelectedLawyers,
  acceptRequest,
  declineRequest,
  findCaseForResponse,
  viewForLawyer,
  findRequest,
  sameId,
};
