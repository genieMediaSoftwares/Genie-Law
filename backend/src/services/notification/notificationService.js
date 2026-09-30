// Notification service: stores the notification, then pushes it to the
// receiver over the realtime socket.

const Notification = require("../../models/Notification");
const { keepAlive } = require("../../utils/background");
const realtimeEvents = require("../../realtime/events");

class NotificationService {
  /**
   * Store a notification and schedule fan-out delivery.
   *
   * @param {object} opts
   * @param {ObjectId|string} opts.senderId   — who triggered it
   * @param {ObjectId|string} opts.receiverId — who should see it (required)
   * @param {string}          opts.title
   * @param {string}          opts.message
   * @param {string}          opts.type        — must be a valid enum value
   * @param {string}          [opts.priority]  — low | medium | high
   * @param {object}          [opts.metadata]  — free-form extra data
   * @param {string|null}     [opts.referenceId] — related entity id
   * @returns {Promise<Document>} the stored notification
   */
  async createAndSendNotification({
    senderId = null,
    receiverId,
    title,
    message,
    type,
    priority = "low",
    metadata = {},
    referenceId = null,
  }) {
    if (!receiverId) {
      throw new Error("receiverId is required to create a notification.");
    }

    // ---- 1. Canonical write (always runs) ----
    const notification = await Notification.create({
      senderId,
      receiverId,
      title,
      message,
      type,
      priority,
      metadata,
      referenceId,
      isRead: false,
      softDelete: false,
    });

    // ---- 2. WebSocket push ----
    realtimeEvents.newNotification(receiverId, notification);

    return notification;
  }
}

const service = new NotificationService();

// Wrap with keepAlive so callers can fire-and-forget or await.
const bound = service.createAndSendNotification.bind(service);
service.createAndSendNotification = (options) => keepAlive(bound(options));

module.exports = service;
