const Chat = require("../../models/Chat");
const notificationService = require("../../services/notification/notificationService");
const realtimeEvents = require("../../realtime/events");
const Message = require("../../models/Message");
const Lawyer = require("../../models/Lawyer");
const Case = require("../../models/Case");
const ApiResponse = require("../../config/ApiResponse");

const PARTICIPANT_FIELDS = "fullName email mobile profileImage role isVerified";

async function attachSpecializations(chats) {
  const lawyerUserIds = [];
  for (const chat of chats) {
    for (const p of chat.participants || []) {
      if (p.role === "lawyer") lawyerUserIds.push(p._id);
    }
  }

  let specializationByUserId = {};
  if (lawyerUserIds.length > 0) {
    const profiles = await Lawyer.find({ user: { $in: lawyerUserIds } })
      .select("user specialization")
      .lean();
    profiles.forEach((profile) => {
      specializationByUserId[profile.user.toString()] =
        profile.specialization || "";
    });
  }

  for (const chat of chats) {
    for (const p of chat.participants || []) {
      p.specialization =
        p.role === "lawyer"
          ? specializationByUserId[p._id.toString()] || ""
          : "";
    }
  }
}

async function loadParticipantChat(chatId, userId) {
  if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) return null;
  const chat = await Chat.findOne({ _id: chatId, participants: userId });
  return chat || null;
}

class ChatController {
  async getOrCreateChat(req, res, next) {
    try {
      const { otherUserId } = req.body;
      const currentUserId = req.user._id;

      if (!otherUserId) {
        return ApiResponse.error(res, "otherUserId is required.", 400);
      }

      let chat = await Chat.findOne({
        participants: { $all: [currentUserId, otherUserId] }
      }).populate("participants", PARTICIPANT_FIELDS);

      const isNew = !chat;
      if (!chat) {
        chat = await Chat.create({
          participants: [currentUserId, otherUserId],
          lastMessage: "",
          lastMessageAt: new Date()
        });
        chat = await Chat.findById(chat._id).populate("participants", PARTICIPANT_FIELDS);
      }

      let chatObj = chat.toObject();
      await attachSpecializations([chatObj]);

      const linkedCase = await Case.findOne({
        $or: [
          { assignedLawyer: currentUserId, client: otherUserId },
          { selectedLawyer: currentUserId, client: otherUserId },
          { assignedLawyer: otherUserId, client: currentUserId },
          { selectedLawyer: otherUserId, client: currentUserId }
        ]
      }).select("title _id");

      if (linkedCase) {
        chatObj.caseInfo = {
          id: linkedCase._id,
          title: linkedCase.title
        };
      }

      chatObj.unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: { $ne: currentUserId },
        isRead: false
      });

      if (isNew) {
        realtimeEvents.chatCreated(otherUserId, chat._id);
      }

      return ApiResponse.success(res, "Chat conversation retrieved.", chatObj);
    } catch (error) {
      next(error);
    }
  }

  async getChats(req, res, next) {
    try {
      const currentUserId = req.user._id;

      const assignedCases = await Case.find({ assignedLawyer: currentUserId })
        .select("client")
        .lean();
      if (assignedCases.length > 0) {
        const clientIds = assignedCases
          .filter((c) => c.client)
          .map((c) => c.client);

        const existing = await Chat.find({
          participants: currentUserId,
        })
          .select("participants")
          .lean();
        const alreadyChattingWith = new Set(
          existing.flatMap((c) =>
            (c.participants || []).map((p) => p.toString())
          )
        );

        const missing = clientIds.filter(
          (id) => !alreadyChattingWith.has(id.toString())
        );
        const uniqueMissing = [
          ...new Map(missing.map((id) => [id.toString(), id])).values(),
        ];

        if (uniqueMissing.length > 0) {
          await Chat.insertMany(
            uniqueMissing.map((clientId) => ({
              participants: [currentUserId, clientId],
              lastMessage: "Consultation accepted. You can now start messaging.",
              lastMessageAt: new Date(),
            }))
          );
        }
      }

      const chats = await Chat.find({ participants: currentUserId })
        .populate("participants", PARTICIPANT_FIELDS)
        .sort({ lastMessageAt: -1 })
        .lean();

      if (chats.length === 0) {
        return ApiResponse.success(res, "Chats fetched successfully.", []);
      }

      await attachSpecializations(chats);

      const chatIds = chats.map(c => c._id);

      const unreadAgg = await Message.aggregate([
        {
          $match: {
            chat: { $in: chatIds },
            sender: { $ne: currentUserId },
            isRead: false
          }
        },
        {
          $group: { _id: "$chat", count: { $sum: 1 } }
        }
      ]);
      const unreadMap = {};
      unreadAgg.forEach(u => { unreadMap[u._id.toString()] = u.count; });

      const otherIds = [];
      const chatToOtherMap = {};

      chats.forEach(chat => {
        const other = (chat.participants || []).find(
          p => p._id.toString() !== currentUserId.toString()
        );
        if (other) {
          otherIds.push(other._id);
          chatToOtherMap[chat._id.toString()] = other._id.toString();
        }
      });

      let caseByOtherId = {};
      if (otherIds.length > 0) {
        const linkedCases = await Case.find({
          $or: [
            { assignedLawyer: currentUserId, client: { $in: otherIds } },
            { selectedLawyer: currentUserId, client: { $in: otherIds } },
            { assignedLawyer: { $in: otherIds }, client: currentUserId },
            { selectedLawyer: { $in: otherIds }, client: currentUserId }
          ]
        }).select("title _id assignedLawyer selectedLawyer client").lean();

        linkedCases.forEach(c => {
          const lawyerId = c.assignedLawyer?.toString() || c.selectedLawyer?.toString() || "";
          const clientId = c.client?.toString() || "";
          const isCurrentUserLawyer = lawyerId === currentUserId.toString();
          const otherId = isCurrentUserLawyer ? clientId : lawyerId;
          if (otherId && !caseByOtherId[otherId]) {
            caseByOtherId[otherId] = { id: c._id, title: c.title };
          }
        });
      }

      const chatsWithData = chats.map(chat => {
        const unreadCount = unreadMap[chat._id.toString()] || 0;
        const otherId = chatToOtherMap[chat._id.toString()];
        const caseInfo = otherId ? (caseByOtherId[otherId] || null) : null;
        return { ...chat, unreadCount, caseInfo };
      });

      return ApiResponse.success(res, "Chats fetched successfully.", chatsWithData);
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { chatId } = req.params;
      const { content, attachments, clientId } = req.body;
      const sender = req.user._id;

      if (!content && (!attachments || attachments.length === 0)) {
        return ApiResponse.error(res, "Message content or attachments is required.", 400);
      }

      const chat = await loadParticipantChat(chatId, sender);
      if (!chat) {
        return ApiResponse.error(res, "Chat not found.", 404);
      }

      if (clientId) {
        const existing = await Message.findOne({ chat: chat._id, clientId })
          .populate("sender", "fullName profileImage role");
        if (existing) {
          return ApiResponse.success(res, "Message already sent.", existing);
        }
      }

      const message = await Message.create({
        chat: chat._id,
        sender,
        content: content || "",
        attachments: attachments || [],
        clientId: clientId || ""
      });

      chat.lastMessage = content || (attachments && attachments.length > 0 ? "Sent an attachment" : "");
      chat.lastMessageAt = new Date();
      chat.lastMessageSender = sender;
      await chat.save();

      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "fullName profileImage role");

      realtimeEvents.chatMessage(chat._id, populatedMessage);
      realtimeEvents.chatUpdated(chat.participants, {
        chatId: chat._id.toString(),
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        senderId: sender.toString()
      });

      const otherParticipant = chat.participants.find((p) => p.toString() !== sender.toString());
      if (otherParticipant) {
        const textPreview = content || (attachments && attachments.length > 0 ? "Attachment" : "");
        await notificationService.createAndSendNotification({
          senderId: sender,
          receiverId: otherParticipant,
          type: "chat_message",
          title: "New Message",
          message: `${req.user.fullName || "Someone"} sent you a message: "${textPreview.substring(0, 30)}${textPreview.length > 30 ? "..." : ""}"`,
          referenceId: chat._id.toString(),
        });
      }

      return ApiResponse.success(res, "Message sent successfully.", populatedMessage, 201);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req, res, next) {
    try {
      const { chatId } = req.params;

      const chat = await loadParticipantChat(chatId, req.user._id);
      if (!chat) {
        return ApiResponse.error(res, "Chat not found.", 404);
      }

      const messages = await Message.find({ chat: chat._id })
        .populate("sender", "fullName profileImage role")
        .sort({ createdAt: 1 });

      return ApiResponse.success(res, "Messages fetched successfully.", messages);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user._id;

      const chat = await loadParticipantChat(chatId, currentUserId);
      if (!chat) {
        return ApiResponse.error(res, "Chat not found.", 404);
      }

      await Message.updateMany(
        { chat: chat._id, sender: { $ne: currentUserId }, isRead: false },
        { isRead: true }
      );

      realtimeEvents.chatRead(currentUserId, chat._id);

      return ApiResponse.success(res, "Messages marked as read.");
    } catch (error) {
      next(error);
    }
  }

  async uploadAttachment(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, "No file uploaded.", 400);
      }

      const chat = await loadParticipantChat(req.params.chatId, req.user._id);
      if (!chat) {
        return ApiResponse.error(res, "Chat not found.", 404);
      }

      const storageService = require("../../services/storageService");
      const metadata = await storageService.uploadFile(req.file, "chat_attachments");
      return ApiResponse.success(res, "File uploaded successfully.", {
        name: req.file.originalname,
        url: metadata.url,
        mimeType: metadata.mimeType || req.file.mimetype,
        size: req.file.size
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
