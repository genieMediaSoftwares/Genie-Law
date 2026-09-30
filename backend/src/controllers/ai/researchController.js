const ApiResponse = require("../../config/ApiResponse");
const AiConversation = require("../../models/AiConversation");
const research = require("../../services/ai/legalResearchService");
const { runInBackground } = require("../../utils/background");

const NOT_FOUND = "Case not found.";

const requireLawyer = (req, res) => {
  if (req.user.role !== "lawyer") {
    ApiResponse.error(res, "Only lawyers can use case research.", 403);
    return false;
  }
  return true;
};

const cleanText = (value, max) => String(value || "").trim().slice(0, max);

class ResearchController {
  async listCases(req, res, next) {
    try {
      if (!requireLawyer(req, res)) return;
      const cases = await research.listCasesForLawyer(req.user._id, req.query.search);
      return ApiResponse.success(res, "Cases retrieved successfully.", cases);
    } catch (error) {
      next(error);
    }
  }

  async listDocuments(req, res, next) {
    try {
      if (!requireLawyer(req, res)) return;
      const caseItem = await research.findCaseForLawyer(req.params.caseId, req.user._id);
      if (!caseItem) return ApiResponse.error(res, NOT_FOUND, 404);

      return ApiResponse.success(res, "Documents retrieved successfully.", {
        case: {
          caseId: String(caseItem._id),
          title: caseItem.title,
          category: caseItem.category,
          clientName: caseItem.client ? caseItem.client.fullName : "",
          court: caseItem.preferredCourt || "",
          status: caseItem.status,
        },
        documents: await research.listCaseDocuments(caseItem),
      });
    } catch (error) {
      next(error);
    }
  }

  async startCaseResearch(req, res, next) {
    try {
      if (!requireLawyer(req, res)) return;

      const { caseId } = req.body;
      const documentIds = Array.isArray(req.body.documentIds) ? req.body.documentIds.map(String) : [];
      const question =
        cleanText(req.body.question, 4000) ||
        "Research this matter: the issues it raises, the provisions and authorities I should verify, the practical and procedural points, and what is missing.";
      const jurisdiction = cleanText(req.body.jurisdiction, 120);

      const caseItem = await research.findCaseForLawyer(caseId, req.user._id);
      if (!caseItem) return ApiResponse.error(res, NOT_FOUND, 404);

      if (documentIds.length > research.MAX_DOCUMENTS) {
        return ApiResponse.error(res, `Select up to ${research.MAX_DOCUMENTS} documents.`, 400);
      }
      if (new Set(documentIds).size !== documentIds.length) {
        return ApiResponse.error(res, "A document was selected more than once.", 400);
      }

      const available = new Map((await research.listCaseDocuments(caseItem)).map((d) => [d.id, d]));
      const foreign = documentIds.filter((id) => !available.has(id));
      if (foreign.length > 0) {
        return ApiResponse.error(res, "One or more selected documents do not belong to this case.", 403);
      }
      const unreadable = documentIds.map((id) => available.get(id)).filter((d) => !d.selectable);
      if (unreadable.length > 0) {
        return ApiResponse.error(
          res,
          `These documents cannot be analysed: ${unreadable.map((d) => `${d.name} (${d.note})`).join("; ")}`,
          400
        );
      }

      const names = documentIds.map((id) => available.get(id).name);
      const visibleQuestion = names.length
        ? `${question}\n\nDocuments: ${names.join(", ")}`
        : question;

      const conversation = await AiConversation.create({
        userId: req.user._id,
        mode: "research",
        title: caseItem.title.slice(0, 60) || "Case Research",
        caseId: caseItem._id,
        caseTitle: caseItem.title,
        jurisdiction,
        researchDocuments: documentIds.map((id, index) => ({
          documentId: id,
          name: available.get(id).name,
          reference: `D${index + 1}`,
          status: "pending",
        })),
        researchStatus: "processing",
        researchStage: "Preparing research",
        messages: [{ role: "user", text: visibleQuestion, timestamp: new Date() }],
      });

      runInBackground("legal-research", () => research.runCaseResearch(conversation._id, question));

      return ApiResponse.success(
        res,
        "Research started.",
        { conversationId: String(conversation._id), status: "processing" },
        202
      );
    } catch (error) {
      next(error);
    }
  }

  async searchRelevantCases(req, res, next) {
    try {
      const { id } = req.params;
      if (!id || typeof id !== "string") return ApiResponse.error(res, "Research session not found.", 404);

      const owned = await AiConversation.findOne({ _id: id, userId: req.user._id, mode: "research" })
        .select("messages researchStatus")
        .lean();
      if (!owned) return ApiResponse.error(res, "Research session not found.", 404);

      if (owned.researchStatus === "processing") {
        return ApiResponse.error(res, "Wait for the research to finish before searching for cases.", 409);
      }
      if (!owned.messages.some((m) => m.role !== "user")) {
        return ApiResponse.error(res, "Ask a research question first, then search for relevant cases.", 400);
      }

      const started = await AiConversation.findOneAndUpdate(
        { _id: id, userId: req.user._id, "relevantCases.status": { $ne: "searching" } },
        {
          $set: {
            "relevantCases.status": "searching",
            "relevantCases.query": cleanText(req.body.query, 500),
            "relevantCases.jurisdiction": cleanText(req.body.jurisdiction, 120),
            "relevantCases.message": "",
          },
        },
        { new: true }
      );

      if (!started) {
        return ApiResponse.error(res, "A case search is already running for this research.", 409);
      }

      runInBackground("relevant-cases", () => research.searchRelevantCases(id));

      return ApiResponse.success(res, "Case search started.", { status: "searching" }, 202);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ResearchController();
