const path = require("path");

const Case = require("../../models/Case");
const AiConversation = require("../../models/AiConversation");
const gemini = require("./geminiClient");
const aiConfig = require("../../config/ai");
const ocrSanitizationService = require("./ocrSanitizationService");
const { RESEARCH_SYSTEM_INSTRUCTION } = require("./researchPrompts");
const fileStore = require("../fileStore");
const { required } = require("../../config/env");


const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp"]);
const MAX_DOCUMENTS = 10;
const MAX_CHARS_PER_DOCUMENT = 40000;
const MAX_CONTEXT_CHARS = 150000;
const MAX_FOLLOW_UP_MESSAGES = 20;
const MAX_RELEVANT_CASES = 6;

const OFFICIAL_LEGAL_DOMAINS = [
  "sci.gov.in",
  "ecourts.gov.in",
  "indiankanoon.org",
  "judis.nic.in",
  "nic.in",
  "gov.in",
];

const DOCUMENT_RULES = `
==========================================================
CASE DOCUMENTS
==========================================================

When case documents are supplied, they are enclosed in <document ref="D1" name="..."> blocks. Treat their content as the record of the matter:
- Refer to a document by its reference, for example [D1], whenever you rely on it.
- Distinguish what a document states from what you infer or assume.
- Treat allegations in a document as allegations, not established facts.
- Never invent page numbers, paragraph numbers or quotations. Quote only text that appears in a document block.
- If a document is marked truncated, say that your reading of it is partial.
- Under "Gaps", name the documents or facts that would resolve each gap.`;

const RELEVANT_CASES_INSTRUCTION = `You are a legal research assistant searching for judicial decisions for a practising advocate.
Use Google Search to find real, reported judicial decisions. Only include a decision if a search result you retrieved describes it.
Never invent a case name, citation, court, date or holding. If you are unsure of a citation, leave it empty.
Describe relevance cautiously: say how the decision may bear on the issue, not that it decides the matter.`;


const searchProvider = () => {
  const configured = required("LEGAL_SEARCH_PROVIDER").toLowerCase();
  return configured === "none" || configured === "off" ? null : configured;
};

const sameId = (a, b) => Boolean(a && b) && String(a._id || a) === String(b._id || b);

const extensionOf = (name) => path.extname(String(name || "").split("?")[0]).toLowerCase();

const toRelativeUploadPath = (url) => {
  const raw = String(url || "").trim();
  const index = raw.indexOf("/uploads/");
  if (index !== -1) return raw.slice(index + 1).split("?")[0];
  if (raw.startsWith("uploads/")) return raw.split("?")[0];
  return null;
};

// The file-store key for a case document URL, or null outside uploads/.
const resolveUploadPath = (url) => fileStore.toKey(toRelativeUploadPath(url));

const describeDocument = async (doc) => {
  const extension = extensionOf(doc.name) || extensionOf(doc.url);
  const key = resolveUploadPath(doc.url);
  const supported = SUPPORTED_EXTENSIONS.has(extension);
  const exists = Boolean(key && (await fileStore.exists(key)));

  let status = "available";
  let note = "";
  if (!supported) {
    status = "unsupported";
    note = `${extension || "This file type"} cannot be read. Supported: PDF, DOCX, TXT and images.`;
  } else if (!exists) {
    status = "missing";
    note = "The file is no longer in storage.";
  }

  return {
    id: String(doc._id),
    name: doc.name || path.basename(toRelativeUploadPath(doc.url) || "Document"),
    type: extension.replace(".", "").toUpperCase(),
    size: doc.size ? String(doc.size) : "",
    status,
    selectable: status === "available",
    note,
  };
};

async function findCaseForLawyer(caseId, lawyerId) {
  if (!caseId || typeof caseId !== "string") return null;
  const caseItem = await Case.findById(caseId).populate("client", "fullName");
  if (!caseItem) return null;
  const engaged = sameId(caseItem.assignedLawyer, lawyerId) || sameId(caseItem.selectedLawyer, lawyerId);
  return engaged ? caseItem : null;
}

async function listCasesForLawyer(lawyerId, search = "") {
  const query = { $or: [{ assignedLawyer: lawyerId }, { selectedLawyer: lawyerId }] };
  const term = String(search || "").trim();
  if (term) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$and = [{ $or: [{ title: pattern }, { category: pattern }, { preferredCourt: pattern }] }];
  }

  const cases = await Case.find(query)
    .populate("client", "fullName")
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return cases.map((c) => ({
    caseId: String(c._id),
    title: c.title,
    category: c.category,
    subcategory: c.subcategory || "",
    clientName: c.client ? c.client.fullName : "",
    court: c.preferredCourt || "",
    location: c.locationCity || c.location || "",
    status: c.status,
    updatedAt: c.updatedAt,
    documentCount: (c.documents || []).length,
  }));
}

async function listCaseDocuments(caseItem) {
  return Promise.all((caseItem.documents || []).map(describeDocument));
}

async function buildDocumentContext(caseItem, documentIds) {
  const byId = new Map((caseItem.documents || []).map((doc) => [String(doc._id), doc]));
  const blocks = [];
  const researchDocuments = [];
  let total = 0;

  documentIds.forEach((id, index) => {
    researchDocuments.push({ documentId: id, reference: `D${index + 1}` });
  });

  for (const entry of researchDocuments) {
    const doc = byId.get(entry.documentId);
    const described = await describeDocument(doc);
    entry.name = described.name;

    if (!described.selectable) {
      entry.status = described.status === "unsupported" ? "unsupported" : "missing";
      entry.note = described.note;
      continue;
    }

    const extraction = await ocrSanitizationService.extractText(
      resolveUploadPath(doc.url),
      "",
      described.name
    );
    const text = (extraction.extractedText || "").trim();

    if (extraction.extractionFailed || !text) {
      entry.status = "failed";
      entry.note = "No readable text could be extracted from this document.";
      continue;
    }

    const remaining = MAX_CONTEXT_CHARS - total;
    const limit = Math.min(MAX_CHARS_PER_DOCUMENT, remaining);
    if (limit <= 0) {
      entry.status = "truncated";
      entry.charCount = 0;
      entry.note = "Not read: the combined documents exceed what one research request can hold.";
      continue;
    }

    const used = text.slice(0, limit);
    const truncated = used.length < text.length;
    total += used.length;
    entry.status = truncated ? "truncated" : "used";
    entry.charCount = used.length;
    entry.note = truncated ? `Only the first ${used.length.toLocaleString("en-IN")} characters were read.` : "";
    blocks.push(
      `<document ref="${entry.reference}" name="${described.name.replace(/"/g, "'")}"${
        truncated ? ' truncated="true"' : ""
      }>\n${used}\n</document>`
    );
  }

  return { context: blocks.join("\n\n"), researchDocuments };
}

const researchInstruction = () => `${RESEARCH_SYSTEM_INSTRUCTION}\n${DOCUMENT_RULES}`;

const safeFailure = "The research could not be completed. Please try again.";

async function runCaseResearch(conversationId, question) {
  const conversation = await AiConversation.findById(conversationId).select("+documentContext");
  if (!conversation) return;

  try {
    const caseItem = await Case.findById(conversation.caseId);
    if (!caseItem) throw new Error("case missing");

    await AiConversation.updateOne({ _id: conversationId }, { researchStage: "Reading selected documents" });
    const documentIds = conversation.researchDocuments.map((d) => d.documentId);
    const { context, researchDocuments } = await buildDocumentContext(caseItem, documentIds);

    const usable = researchDocuments.filter((d) => d.status === "used" || d.status === "truncated");
    if (documentIds.length > 0 && usable.length === 0) {
      await AiConversation.updateOne(
        { _id: conversationId },
        {
          researchDocuments,
          researchStatus: "failed",
          researchStage: "",
          researchError: "None of the selected documents could be read. Choose other documents or research without them.",
        }
      );
      return;
    }

    await AiConversation.updateOne(
      { _id: conversationId },
      { researchDocuments, documentContext: context, researchStage: "Analysing issues and authorities" }
    );

    const prompt = [
      `Matter: ${caseItem.title} (${caseItem.category}${caseItem.subcategory ? `, ${caseItem.subcategory}` : ""}).`,
      conversation.jurisdiction ? `Jurisdiction: ${conversation.jurisdiction}.` : "",
      caseItem.preferredCourt ? `Court: ${caseItem.preferredCourt}.` : "",
      context ? `\n${context}\n` : "No documents were selected for this research.",
      `Research request: ${question}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await gemini.generate([{ text: prompt }], {
      label: "legal-research",
      systemInstruction: researchInstruction(),
      timeoutMs: aiConfig.TIMEOUTS.research,
    });

    if (!result.text) {
      await AiConversation.updateOne(
        { _id: conversationId },
        { researchStatus: "failed", researchStage: "", researchError: safeFailure }
      );
      return;
    }

    await AiConversation.updateOne(
      { _id: conversationId },
      {
        $push: { messages: { role: "model", text: result.text, timestamp: new Date() } },
        $set: { researchStatus: "completed", researchStage: "", researchError: "" },
      }
    );
  } catch (error) {
    console.error("[legal-research] run failed:", error.message);
    await AiConversation.updateOne(
      { _id: conversationId },
      { researchStatus: "failed", researchStage: "", researchError: safeFailure }
    );
  }
}

const domainOf = (source) => {
  const title = String(source.title || "").toLowerCase();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(title)) return title;
  try {
    return new URL(source.uri).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const isOfficialLegalSource = (domain) =>
  OFFICIAL_LEGAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));

const extractJsonArray = (text) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalise = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function groundCaseResults(text, sources, supports, retrievedAt = new Date()) {
  const items = extractJsonArray(text);
  const results = [];

  for (const item of items) {
    const caseTitle = String(item.caseTitle || item.title || "").trim();
    if (!caseTitle) continue;

    const titleKey = normalise(caseTitle).slice(0, 30);
    const citationKey = normalise(item.citation).slice(0, 20);
    const indices = new Set();

    for (const support of supports) {
      const segment = normalise(support.text);
      if ((titleKey && segment.includes(titleKey)) || (citationKey && segment.includes(citationKey))) {
        support.sourceIndices.forEach((i) => indices.add(i));
      }
    }

    const grounded = [...indices].map((i) => sources[i]).filter(Boolean);
    if (grounded.length === 0) continue;

    const official = grounded.some((s) => isOfficialLegalSource(domainOf(s)));

    results.push({
      caseTitle,
      citation: String(item.citation || "").trim(),
      court: String(item.court || "").trim(),
      jurisdiction: String(item.jurisdiction || "").trim(),
      decisionDate: String(item.decisionDate || item.date || "").trim(),
      relevanceSummary: String(item.relevance || item.relevanceSummary || "").trim(),
      legalPrinciple: String(item.principle || item.legalPrinciple || "").trim(),
      sources: grounded.slice(0, 3).map((s) => ({ url: s.uri, name: domainOf(s) || s.title })),
      verificationStatus: official ? "Source Retrieved" : "Search Result — Not Yet Verified",
      retrievedAt,
    });

    if (results.length >= MAX_RELEVANT_CASES) break;
  }

  return results;
}

const sectionFrom = (markdown, heading) => {
  const match = String(markdown || "").match(new RegExp(`#{2,4}\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{2,4}\\s|$)`, "i"));
  return match ? match[1].trim() : "";
};

async function searchRelevantCases(conversationId) {
  const conversation = await AiConversation.findById(conversationId);
  if (!conversation) return;

  const provider = searchProvider();
  if (!provider) {
    await AiConversation.updateOne(
      { _id: conversationId },
      {
        "relevantCases.status": "unavailable",
        "relevantCases.message": "Relevant case search is not enabled on this server.",
      }
    );
    return;
  }

  try {
    const firstQuestion = conversation.messages.find((m) => m.role === "user");
    const lastAnswer = [...conversation.messages].reverse().find((m) => m.role !== "user");
    const issue = sectionFrom(lastAnswer && lastAnswer.text, "Issue") || (lastAnswer ? lastAnswer.text.slice(0, 1500) : "");
    const jurisdiction = conversation.relevantCases.jurisdiction || conversation.jurisdiction || "India";

    const prompt = [
      `Find up to ${MAX_RELEVANT_CASES} judicial decisions relevant to this research.`,
      `Jurisdiction: ${jurisdiction}.`,
      conversation.caseTitle ? `Matter: ${conversation.caseTitle}.` : "",
      firstQuestion ? `Research question: ${firstQuestion.text.slice(0, 1500)}` : "",
      issue ? `Issues identified:\n${issue.slice(0, 2000)}` : "",
      conversation.relevantCases.query ? `Refine the search: ${conversation.relevantCases.query}` : "",
      "Answer with a JSON array in a ```json code block. Each item: {\"caseTitle\", \"citation\", \"court\", \"jurisdiction\", \"decisionDate\", \"relevance\", \"principle\"}. Use empty strings for anything the search results do not state. Return [] if you found nothing relevant.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await gemini.generateWithSearch(prompt, { systemInstruction: RELEVANT_CASES_INSTRUCTION });

    if (!result.text || result.sources.length === 0) {
      await AiConversation.updateOne(
        { _id: conversationId },
        {
          "relevantCases.status": "failed",
          "relevantCases.results": [],
          "relevantCases.provider": provider,
          "relevantCases.message": "The case search could not be completed. No results are shown because none could be retrieved from a source.",
        }
      );
      return;
    }

    const results = groundCaseResults(result.text, result.sources, result.supports);

    await AiConversation.updateOne(
      { _id: conversationId },
      {
        "relevantCases.status": "completed",
        "relevantCases.results": results,
        "relevantCases.provider": provider,
        "relevantCases.searchedAt": new Date(),
        "relevantCases.message": results.length
          ? ""
          : "No decisions could be matched to a retrieved source. Try refining the search or naming the court.",
      }
    );
  } catch (error) {
    console.error("[relevant-cases] search failed:", error.message);
    await AiConversation.updateOne(
      { _id: conversationId },
      {
        "relevantCases.status": "failed",
        "relevantCases.message": "The case search could not be completed. Please try again.",
      }
    );
  }
}

function buildFollowUpContext(conversation) {
  const parts = [];
  if (conversation.caseTitle) parts.push(`This research concerns the matter "${conversation.caseTitle}".`);
  if (conversation.jurisdiction) parts.push(`Jurisdiction: ${conversation.jurisdiction}.`);
  if (conversation.documentContext) {
    parts.push(`The selected case documents follow.\n${conversation.documentContext}`);
  }
  const cases = (conversation.relevantCases && conversation.relevantCases.results) || [];
  if (cases.length) {
    parts.push(
      "Relevant cases retrieved by search in this session (search results, not verified citations):\n" +
        cases
          .map((c, i) => `${i + 1}. ${c.caseTitle}${c.court ? `, ${c.court}` : ""}${c.decisionDate ? ` (${c.decisionDate})` : ""} — ${c.relevanceSummary}`)
          .join("\n")
    );
  }
  return parts.join("\n\n");
}

// With no options every running job is failed (Node startup: nothing can still
// be running). The scheduled maintenance sweep passes `olderThan` so only runs that
// stopped making progress are failed.
async function recoverAbandonedResearch({ olderThan } = {}) {
  const stale = olderThan ? { updatedAt: { $lt: olderThan } } : {};
  await AiConversation.updateMany(
    { researchStatus: "processing", ...stale },
    { researchStatus: "failed", researchStage: "", researchError: "The research was interrupted. Please run it again." }
  );
  await AiConversation.updateMany(
    { "relevantCases.status": "searching", ...stale },
    { "relevantCases.status": "failed", "relevantCases.message": "The search was interrupted. Please try again." }
  );
}

module.exports = {
  MAX_DOCUMENTS,
  MAX_FOLLOW_UP_MESSAGES,
  researchInstruction,
  findCaseForLawyer,
  listCasesForLawyer,
  listCaseDocuments,
  buildDocumentContext,
  runCaseResearch,
  searchRelevantCases,
  groundCaseResults,
  buildFollowUpContext,
  recoverAbandonedResearch,
  searchProvider,
};
