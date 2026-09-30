const Issue = require("../../models/Issue");
const ApiResponse = require("../../config/ApiResponse");
const notificationService = require("../../services/notification/notificationService");

const ISSUE_CATEGORIES = [
  "Consultation Issue",
  "Payment Issue",
  "Lawyer Behavior",
  "Case Issue",
  "Document Issue",
  "Technical Issue",
  "Refund Request",
  "Other",
];

const STATUSES = ["Pending", "Assigned", "Resolved", "Closed"];

class IssueController {
  async createIssue(req, res, next) {
    try {
      const { title, description, category, documents, urgency, preferredMode, location, preferredLanguage } = req.body;
      const userId = req.user._id;

      if (!title || !description || !category) {
        return ApiResponse.error(res, "Title, description, and category are required.", 400);
      }

      if (!ISSUE_CATEGORIES.includes(category)) {
        return ApiResponse.error(res, `Category must be one of: ${ISSUE_CATEGORIES.join(", ")}.`, 400);
      }

      const issue = await Issue.create({
        title,
        description,
        category,
        clientId: userId,
        status: "Pending",
        urgency: urgency || "Flexible",
        preferredMode: preferredMode || "Chat",
        location: location || "",
        preferredLanguage: preferredLanguage || "English",
        documents: documents || [],
        images: [],
      });

      notificationService.createAndSendNotification({
        receiverId: userId,
        type: "dispute_created",
        title: "Dispute Filed",
        message: `Your dispute "${title}" has been filed successfully.`,
        referenceId: issue._id.toString(),
      }).catch(() => {});

      return ApiResponse.success(res, "Dispute created successfully.", issue, 201);
    } catch (error) {
      next(error);
    }
  }

  async getIssues(req, res, next) {
    try {
      const userId = req.user._id;
      const { status } = req.query;
      const query = { clientId: userId };
      if (status && status !== "all") {
        query.status = status;
      }
      const issues = await Issue.find(query).sort({ createdAt: -1 });
      return ApiResponse.success(res, "Disputes fetched.", issues);
    } catch (error) {
      next(error);
    }
  }

  async getIssueStatus(req, res, next) {
    try {
      const { id } = req.params;
      const issue = await Issue.findById(id).select("status");
      if (!issue) {
        return ApiResponse.error(res, "Issue not found.", 404);
      }
      return ApiResponse.success(res, "Issue status fetched.", { status: issue.status });
    } catch (error) {
      next(error);
    }
  }

  async getIssueById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const issue = await Issue.findById(id);
      if (!issue) {
        return ApiResponse.error(res, "Dispute not found.", 404);
      }
      if (issue.clientId.toString() !== userId.toString() && req.user.role !== "admin") {
        return ApiResponse.error(res, "Not authorized to view this dispute.", 403);
      }
      return ApiResponse.success(res, "Dispute fetched.", issue);
    } catch (error) {
      next(error);
    }
  }

  async updateIssue(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const issue = await Issue.findById(id);
      if (!issue) {
        return ApiResponse.error(res, "Dispute not found.", 404);
      }
      if (status && STATUSES.includes(status)) {
        issue.status = status;
      }
      await issue.save();
      return ApiResponse.success(res, "Dispute updated successfully.", issue);
    } catch (error) {
      next(error);
    }
  }

  async deleteIssue(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const issue = await Issue.findById(id);
      if (!issue) {
        return ApiResponse.error(res, "Dispute not found.", 404);
      }
      if (issue.clientId.toString() !== userId.toString()) {
        return ApiResponse.error(res, "Not authorized to delete this dispute.", 403);
      }
      await Issue.findByIdAndDelete(id);
      return ApiResponse.success(res, "Dispute deleted successfully.");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new IssueController();
