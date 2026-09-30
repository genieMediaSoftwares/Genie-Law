const LegalDocument = require("../../models/LegalDocument");
const LegalAcceptance = require("../../models/LegalAcceptance");
const ApiResponse = require("../../config/ApiResponse");

const { LEGAL_DOCUMENT_TYPES } = LegalDocument;

// Documents that apply to a given role: everything marked "all" plus that
// role's own documents.
const audienceFilter = (role) =>
  role === "client" || role === "lawyer"
    ? { audience: { $in: ["all", role] } }
    : {};

const publicFields = "type version title content effectiveDate audience requiresAcceptance legallyReviewed updatedAt";

class LegalController {
  // The currently published documents. Public: the app shows terms and privacy
  // before anyone signs in.
  async listActive(req, res, next) {
    try {
      const { audience } = req.query;
      const filter = { isActive: true, ...audienceFilter(audience) };

      const documents = await LegalDocument.find(filter)
        .select(publicFields)
        .sort({ type: 1 });

      return ApiResponse.success(res, "Legal documents fetched.", documents);
    } catch (error) {
      next(error);
    }
  }

  async getByType(req, res, next) {
    try {
      const { type } = req.params;

      if (!LEGAL_DOCUMENT_TYPES.includes(type)) {
        return ApiResponse.error(res, "Unknown legal document type.", 400);
      }

      const document = await LegalDocument.findOne({ type, isActive: true }).select(
        publicFields
      );

      if (!document) {
        return ApiResponse.error(res, "That document has not been published yet.", 404);
      }

      return ApiResponse.success(res, "Legal document fetched.", document);
    } catch (error) {
      next(error);
    }
  }

  // Active documents for this user's role that require acceptance and that the
  // user has not accepted at their current version.
  async listPending(req, res, next) {
    try {
      const documents = await LegalDocument.find({
        isActive: true,
        requiresAcceptance: true,
        ...audienceFilter(req.user.role),
      }).select(publicFields);

      if (documents.length === 0) {
        return ApiResponse.success(res, "No documents awaiting acceptance.", []);
      }

      const accepted = await LegalAcceptance.find({
        user: req.user._id,
        documentType: { $in: documents.map((doc) => doc.type) },
      }).select("documentType version");

      const acceptedKey = new Set(
        accepted.map((record) => `${record.documentType}@${record.version}`)
      );

      const pending = documents.filter(
        (doc) => !acceptedKey.has(`${doc.type}@${doc.version}`)
      );

      return ApiResponse.success(res, "Documents awaiting acceptance.", pending);
    } catch (error) {
      next(error);
    }
  }

  async accept(req, res, next) {
    try {
      const { type, version, appVersion } = req.body;

      if (!type || !version) {
        return ApiResponse.error(res, "Document type and version are required.", 400);
      }

      const document = await LegalDocument.findOne({ type, version });
      if (!document) {
        return ApiResponse.error(res, "That document version does not exist.", 404);
      }

      if (!document.isActive) {
        return ApiResponse.error(
          res,
          "That version is no longer the published one.",
          409
        );
      }

      // Re-accepting the same version is not an error; the first record stands.
      const existing = await LegalAcceptance.findOne({
        user: req.user._id,
        documentType: type,
        version,
      });

      if (existing) {
        return ApiResponse.success(res, "Already accepted.", existing);
      }

      const record = await LegalAcceptance.create({
        user: req.user._id,
        document: document._id,
        documentType: type,
        version,
        appVersion: appVersion || "",
      });

      return ApiResponse.success(res, "Acceptance recorded.", record, 201);
    } catch (error) {
      next(error);
    }
  }

  // The signed-in user's own acceptance history.
  async myAcceptances(req, res, next) {
    try {
      const records = await LegalAcceptance.find({ user: req.user._id })
        .select("documentType version acceptedAt appVersion")
        .sort({ acceptedAt: -1 });

      return ApiResponse.success(res, "Acceptance history fetched.", records);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LegalController();
