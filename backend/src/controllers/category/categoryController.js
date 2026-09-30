const Category = require("../../models/Category");
const ApiResponse = require("../../config/ApiResponse");
const { categories: legalCategories } = require("../../config/legalCategories");

class CategoryController {
  // [{ id, title, slug, subTypes }] in the order defined by the taxonomy.
  legalTaxonomy(req, res) {
    res.setHeader("Cache-Control", "public, max-age=300");
    return ApiResponse.success(res, "Legal categories fetched.", legalCategories);
  }

  async list(req, res, next) {
    try {
      const { status } = req.query;
      const query = {};
      if (status && status !== "all") query.status = status;
      const categories = await Category.find(query).sort({ order: 1, name: 1 });
      return ApiResponse.success(res, "Categories fetched.", categories);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { name, description, status, order } = req.body;
      if (!name) {
        return ApiResponse.error(res, "Category name is required.", 400);
      }
      const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
      if (existing) {
        return ApiResponse.error(res, "A category with this name already exists.", 409);
      }
      const category = await Category.create({ name, description: description || "", status: status || "active", order: order || 0 });
      return ApiResponse.success(res, "Category created successfully.", category, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, status, order } = req.body;
      const category = await Category.findById(id);
      if (!category) {
        return ApiResponse.error(res, "Category not found.", 404);
      }
      if (name) category.name = name;
      if (description !== undefined) category.description = description;
      if (status) category.status = status;
      if (order !== undefined) category.order = order;
      await category.save();
      return ApiResponse.success(res, "Category updated successfully.", category);
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) {
        return ApiResponse.error(res, "Category not found.", 404);
      }
      await Category.findByIdAndDelete(id);
      return ApiResponse.success(res, "Category deleted successfully.");
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) {
        return ApiResponse.error(res, "Category not found.", 404);
      }
      return ApiResponse.success(res, "Category fetched.", category);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();
