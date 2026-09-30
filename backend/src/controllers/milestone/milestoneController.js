const Milestone = require("../../models/Milestone");
const ApiResponse = require("../../config/ApiResponse");

class MilestoneController {
  async listByCase(req, res, next) {
    try {
      const { caseId } = req.params;
      const milestones = await Milestone.find({ caseId }).sort({ order: 1, createdAt: 1 });
      return ApiResponse.success(res, "Milestones fetched.", milestones);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { title, description, order, dueDate } = req.body;
      // The route is POST /milestones/case/:caseId; older clients send it in the body.
      const caseId = req.params.caseId || req.body.caseId;
      if (!caseId || !title) {
        return ApiResponse.error(res, "Case ID and title are required.", 400);
      }
      const milestone = await Milestone.create({
        caseId,
        title,
        description: description || "",
        order: order || 0,
        dueDate: dueDate || null,
        createdBy: req.user._id,
      });
      return ApiResponse.success(res, "Milestone created.", milestone, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title, description, status, dueDate, order } = req.body;
      const milestone = await Milestone.findById(id);
      if (!milestone) {
        return ApiResponse.error(res, "Milestone not found.", 404);
      }
      if (title !== undefined) milestone.title = title;
      if (description !== undefined) milestone.description = description;
      if (status !== undefined) milestone.status = status;
      if (dueDate !== undefined) milestone.dueDate = dueDate;
      if (order !== undefined) milestone.order = order;
      await milestone.save();
      return ApiResponse.success(res, "Milestone updated.", milestone);
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      await Milestone.findByIdAndDelete(id);
      return ApiResponse.success(res, "Milestone deleted.");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MilestoneController();
