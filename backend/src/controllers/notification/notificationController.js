const Notification = require("../../models/Notification");
const ApiResponse = require("../../config/ApiResponse");

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const receiverId = req.user._id;
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 15;
      const skip = (page - 1) * limit;

      const query = {
        receiverId,
        softDelete: false,
      };

      const notifications = await Notification.find(query)
        .populate("senderId", "fullName profileImage role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        receiverId,
        isRead: false,
        softDelete: false,
      });

      return ApiResponse.success(res, "Notifications fetched successfully.", {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const receiverId = req.user._id;

      const notification = await Notification.findOneAndUpdate(
        {
          $or: [{ _id: id }, { notificationId: id }],
          receiverId,
        },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return ApiResponse.error(res, "Notification not found or unauthorized.", 404);
      }

      return ApiResponse.success(res, "Notification marked as read.", notification);
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const receiverId = req.user._id;

      await Notification.updateMany(
        { receiverId, isRead: false, softDelete: false },
        { isRead: true }
      );

      return ApiResponse.success(res, "All notifications marked as read.");
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      const receiverId = req.user._id;

      const notification = await Notification.findOneAndUpdate(
        {
          $or: [{ _id: id }, { notificationId: id }],
          receiverId,
        },
        { softDelete: true },
        { new: true }
      );

      if (!notification) {
        return ApiResponse.error(res, "Notification not found or unauthorized.", 404);
      }

      return ApiResponse.success(res, "Notification deleted successfully.");
    } catch (error) {
      next(error);
    }
  }

  async clearAllFromSender(req, res, next) {
    try {
      const { senderId } = req.params;
      const receiverId = req.user._id;

      await Notification.updateMany(
        { receiverId, senderId, softDelete: false },
        { softDelete: true }
      );

      return ApiResponse.success(res, "All notifications from sender cleared.");
    } catch (error) {
      next(error);
    }
  }

  async clearAllNotifications(req, res, next) {
    try {
      const receiverId = req.user._id;

      await Notification.updateMany(
        { receiverId, softDelete: false },
        { softDelete: true }
      );

      return ApiResponse.success(res, "All notifications cleared.");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
