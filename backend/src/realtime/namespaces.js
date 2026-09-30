// Namespaces the realtime server accepts and the client -> server events each
// one handles. Every authenticated socket joins a room named after its user id,
// which is where server -> client events for that user are sent (events.js).

const NAMESPACES = {
  ROOT: "/",
  NOTIFICATIONS: "/notifications",
  CASES: "/cases",
  CHAT: "/chat",
  AI: "/ai",
};

const ALL_NAMESPACES = new Set(Object.values(NAMESPACES));
const AUTHENTICATED_NAMESPACES = new Set([
  NAMESPACES.NOTIFICATIONS,
  NAMESPACES.CASES,
  NAMESPACES.CHAT,
  NAMESPACES.AI,
]);

// Rooms a socket may hold in one namespace, including its own user room.
const MAX_ROOMS_PER_NAMESPACE = 40;

// --- /chat -----------------------------------------------------------------

async function chatJoin({ socket, payload, ack, sendError }) {
  const chatId = payload && payload.chatId ? String(payload.chatId) : "";
  if (!chatId) return ack({ ok: false, reason: "no_chat_id" });
  try {
    const Chat = require("../models/Chat");
    if (!(await Chat.exists({ _id: chatId, participants: socket.data.userId }))) {
      sendError("Not a participant of this chat.");
      return ack({ ok: false, reason: "forbidden" });
    }
  } catch {
    return ack({ ok: false, reason: "invalid" });
  }
  const chats = socket.data.chatRooms;
  if (!chats.includes(chatId)) {
    chats.push(chatId);
    socket.join(chatId);
    // Keep the user's own room; drop the oldest chat rooms beyond the cap.
    while (chats.length > MAX_ROOMS_PER_NAMESPACE - 1) socket.leave(chats.shift());
  }
  return ack({ ok: true });
}

function chatLeave({ socket, payload }) {
  const chatId = payload && payload.chatId ? String(payload.chatId) : "";
  if (!chatId || chatId === socket.data.userId) return;
  const chats = socket.data.chatRooms;
  const index = chats.indexOf(chatId);
  if (index !== -1) chats.splice(index, 1);
  socket.leave(chatId);
}

function chatTyping({ socket, payload }) {
  const chatId = payload && payload.chatId ? String(payload.chatId) : "";
  if (!chatId || !socket.data.chatRooms.includes(chatId)) return;
  // To everyone else in the chat room (not back to the sender).
  socket.to(chatId).emit("typing", { chatId, userName: payload.userName, isTyping: payload.isTyping === true });
}

// --- /ai -------------------------------------------------------------------

// Returns the current state of an AI Smart Case session so a client that
// (re)connects mid-analysis can catch up before live progress events arrive.
async function aiWatchSession({ socket, payload, ack }) {
  const sessionId = String((payload && payload.sessionId) || "");
  if (!sessionId) return ack({ error: "Invalid session id." });
  try {
    const tempSessions = require("../services/ai/tempSessionStore");
    const session = await tempSessions.findOne({ _id: sessionId, client: socket.data.userId });
    if (!session) return ack({ error: "Session not found." });
    return ack({
      sessionId: String(session._id),
      status: session.status,
      progress: session.progress,
      extracted: session.extractedData,
      uploadedDocuments: session.uploadedDocuments,
      voiceTranscript: session.voiceTranscript,
      voiceTranscriptionFailed: session.voiceTranscriptionFailed,
      extractionWarnings: session.warnings,
      failureReason: session.failureReason,
    });
  } catch {
    return ack({ error: "Could not read that session." });
  }
}

// namespace -> event -> handler. Unlisted events are acked as unknown_event.
const HANDLERS = {
  [NAMESPACES.CHAT]: {
    join: chatJoin,
    leave: chatLeave,
    typing: chatTyping,
  },
  [NAMESPACES.AI]: {
    watch_session: aiWatchSession,
  },
};

function findHandler(namespace, event) {
  const handlers = HANDLERS[namespace];
  return (handlers && Object.prototype.hasOwnProperty.call(handlers, event) && handlers[event]) || null;
}

module.exports = {
  NAMESPACES,
  ALL_NAMESPACES,
  AUTHENTICATED_NAMESPACES,
  findHandler,
};
