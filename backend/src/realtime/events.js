// Every server -> client realtime event the backend sends. Controllers and
// services call these instead of building emits themselves, so each event's
// namespace, room and name are defined in one place.
//
// Each authenticated socket is in a room named after its user id; chat
// sockets also join one room per open chat (namespaces.js).

const { NAMESPACES } = require("./namespaces");
const { emit } = require("./emitter");

const idString = (id) => (id && id._id ? id._id : id).toString();

// Sends to each user's room once, skipping empty ids.
function toUsers(namespace, userIds, event, payloadFor) {
  const sent = new Set();
  for (const userId of userIds) {
    if (!userId) continue;
    const room = idString(userId);
    if (sent.has(room)) continue;
    sent.add(room);
    emit({ namespace, room, event, payload: typeof payloadFor === "function" ? payloadFor(room) : payloadFor });
  }
}

// --- /cases ----------------------------------------------------------------

// `caseItem` goes to every user in `userIds`; pass `payloadFor(userId)` to send
// each one a tailored view instead.
function caseUpdated(userIds, caseItem, payloadFor = null) {
  toUsers(NAMESPACES.CASES, userIds, "case_updated", payloadFor || caseItem);
}

// --- /chat -----------------------------------------------------------------

function chatCreated(userId, chatId) {
  toUsers(NAMESPACES.CHAT, [userId], "chat_created", { chatId: idString(chatId) });
}

// New message to everyone with the chat open.
function chatMessage(chatId, message) {
  emit({ namespace: NAMESPACES.CHAT, room: idString(chatId), event: "message", payload: message });
}

// Chat list preview update for each participant.
function chatUpdated(participantIds, summary) {
  toUsers(NAMESPACES.CHAT, participantIds, "chat_updated", summary);
}

function chatRead(userId, chatId) {
  toUsers(NAMESPACES.CHAT, [userId], "chat_read", { chatId: idString(chatId) });
}

// --- /notifications --------------------------------------------------------

function newNotification(userId, notification) {
  toUsers(NAMESPACES.NOTIFICATIONS, [userId], "new_notification", notification);
}

// --- /ai -------------------------------------------------------------------

// AI Smart Case progress: analysis_progress, analysis_complete, analysis_failed.
function aiAnalysis(userId, event, payload) {
  toUsers(NAMESPACES.AI, [userId], event, payload);
}

// --- / (everyone connected) ------------------------------------------------

function lawyerVerificationUpdated(lawyerId, status) {
  emit({ namespace: NAMESPACES.ROOT, event: "lawyer_verification_updated", payload: { lawyerId, status } });
}

// A lawyer's rating aggregate changed (services/review/ratingService). Ratings
// are public, so every connected client gets it.
function lawyerRatingUpdated({ lawyerId, rating, totalReviews, updatedAt }) {
  emit({
    namespace: NAMESPACES.ROOT,
    event: "lawyer_rating_updated",
    payload: { lawyerId: idString(lawyerId), rating, totalReviews, updatedAt },
  });
}

function adminBroadcast({ title, message, targetRole }) {
  emit({ namespace: NAMESPACES.ROOT, event: "admin_broadcast", payload: { title, message, targetRole } });
}

module.exports = {
  caseUpdated,
  chatCreated,
  chatMessage,
  chatUpdated,
  chatRead,
  newNotification,
  aiAnalysis,
  lawyerVerificationUpdated,
  lawyerRatingUpdated,
  adminBroadcast,
};
