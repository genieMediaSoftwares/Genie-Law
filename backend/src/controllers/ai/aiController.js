const geminiClient = require("../../services/ai/geminiClient");
const aiConfig = require("../../config/ai");
const log = require("../../utils/structuredLogger");
const ApiResponse = require("../../config/ApiResponse");
const AiConversation = require("../../models/AiConversation");
const fileStore = require("../../services/fileStore");
const tempFiles = require("../../services/ai/tempFiles");
const {
  detectTranscriptLanguage,
  normaliseLanguageCode,
} = require("../../utils/transcriptLanguage");

const TRANSCRIPTION_PROMPT =
  "Transcribe this audio recording of a legal case description verbatim.\n" +
  "Rules:\n" +
  "1. Detect the language actually spoken and write the transcript in THAT language. " +
  "Do not translate the speech into any other language.\n" +
  "2. Use the native script of the spoken language: Telugu speech in Telugu script (తెలుగు), " +
  "Hindi speech in Devanagari script (देवनागरी), English speech in Latin letters. " +
  "Never romanise or transliterate Telugu or Hindi into English letters.\n" +
  "3. If the speaker mixes languages, keep each phrase in the language and script it was spoken in.\n" +
  "4. Legal terms said in English — FIR, IPC, BNS, CrPC, Section 138, High Court, bail, " +
  "writ, case numbers and dates — stay in English letters exactly as spoken, inside the " +
  "surrounding Telugu or Hindi sentence.\n" +
  "5. Keep the speaker's own words, punctuation and sentence breaks. Do not summarise, " +
  "correct, explain or add anything.\n" +
  "Return only the transcript text — no preamble, no labels, no metadata.";

const LANGUAGE_NAMES = { en: "English", hi: "Hindi", te: "Telugu" };

const { RESEARCH_SYSTEM_INSTRUCTION } = require("../../services/ai/researchPrompts");
const legalResearchService = require("../../services/ai/legalResearchService");
const { optional } = require("../../config/env");

function transcriptionPromptFor(languageCode) {
  const name = LANGUAGE_NAMES[languageCode];
  if (!name) return TRANSCRIPTION_PROMPT;
  return (
    `The speaker has told us they are speaking ${name}. Transcribe in ${name}, ` +
    `in its own script.\n${TRANSCRIPTION_PROMPT}`
  );
}

function generateTitle(message) {
  if (!message) return "New Legal Conversation";
  let title = message.trim().split("\n")[0];
  title = title.replace(/[#*`_~]/g, "").trim();
  if (title.length > 35) {
    title = title.substring(0, 35) + "...";
  }
  return title || "New Legal Conversation";
}

const resolveMode = (value) => {
  const mode = value === "research" ? "research" : "chat";
  return {
    mode,
    filter: mode === "research" ? { mode: "research" } : { mode: { $ne: "research" } },
  };
};

class AiController {
  async getConversations(req, res, next) {
    try {
      const userId = req.user._id;
      const { filter } = resolveMode(req.query.mode);
      const conversations = await AiConversation.find({
        userId,
        status: "active",
        ...filter,
      })
        .sort({ updatedAt: -1 })
        .select("_id title messages createdAt updatedAt caseTitle researchStatus");

      const formatted = conversations.map((c) => {
        const lastMsg = c.messages[c.messages.length - 1];
        return {
          id: c._id.toString(),
          title: c.title,
          lastMessage: lastMsg ? lastMsg.text : "",
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          messageCount: c.messages.length,
          caseTitle: c.caseTitle || "",
          researchStatus: c.researchStatus || "idle",
        };
      });

      return ApiResponse.success(res, "Conversations retrieved successfully.", {
        conversations: formatted,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversationById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const conversation = await AiConversation.findOne({ _id: id, userId });
      if (!conversation) {
        return ApiResponse.error(res, "Conversation not found.", 404);
      }

      return ApiResponse.success(res, "Conversation retrieved successfully.", {
        conversation: {
          id: conversation._id.toString(),
          title: conversation.title,
          status: conversation.status,
          messages: conversation.messages,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          mode: conversation.mode,
          caseId: conversation.caseId ? conversation.caseId.toString() : null,
          caseTitle: conversation.caseTitle || "",
          jurisdiction: conversation.jurisdiction || "",
          researchDocuments: conversation.researchDocuments || [],
          researchStatus: conversation.researchStatus || "idle",
          researchStage: conversation.researchStage || "",
          researchError: conversation.researchError || "",
          relevantCases: conversation.relevantCases || { status: "idle", results: [] },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async createConversation(req, res, next) {
    try {
      const userId = req.user._id;
      const { title } = req.body;
      const { mode } = resolveMode(req.body.mode);

      const conversation = await AiConversation.create({
        userId,
        title: title || (mode === "research" ? "New Research" : "New Legal Conversation"),
        mode,
        messages: [],
      });

      return ApiResponse.success(res, "Conversation created successfully.", {
        conversation: {
          id: conversation._id.toString(),
          title: conversation.title,
          messages: conversation.messages,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const conversation = await AiConversation.findOneAndDelete({ _id: id, userId });
      if (!conversation) {
        return ApiResponse.error(res, "Conversation not found.", 404);
      }

      return ApiResponse.success(res, "Conversation deleted successfully.", { id });
    } catch (error) {
      next(error);
    }
  }

  async deleteAllConversations(req, res, next) {
    try {
      const userId = req.user._id;
      const { filter } = resolveMode(req.query.mode);
      await AiConversation.deleteMany({ userId, ...filter });

      return ApiResponse.success(res, "All conversations deleted successfully.");
    } catch (error) {
      next(error);
    }
  }

  async chat(req, res, next) {
    try {
      const { message, conversationId, history } = req.body;
      const userId = req.user._id;
      const { mode } = resolveMode(req.body.mode);

      if (!message || typeof message !== "string" || !message.trim()) {
        return ApiResponse.error(res, "Message is required.", 400);
      }

      const apiKey = optional("GEMINI_API_KEY");
      if (!apiKey) {
        return ApiResponse.error(
          res,
          "Gemini API key is not configured. Please add it to your environment variables.",
          500
        );
      }

      let conversation = null;

      if (conversationId) {
        conversation = await AiConversation.findOne({ _id: conversationId, userId }).select("+documentContext");
        if (!conversation) {
          return ApiResponse.error(res, "Conversation not found.", 404);
        }
        if (conversation.researchStatus === "processing") {
          return ApiResponse.error(res, "The research is still running. Ask your question once it finishes.", 409);
        }
      } else {
        conversation = new AiConversation({
          userId,
          title: generateTitle(message),
          mode,
          messages: [],
        });
      }

      conversation.messages.push({
        role: "user",
        text: message.trim(),
        timestamp: new Date(),
      });

      const contents = [];
      const recentMessages = mode === "research"
        ? conversation.messages.slice(-legalResearchService.MAX_FOLLOW_UP_MESSAGES)
        : conversation.messages;
      for (const msg of recentMessages) {
        contents.push({
          role: msg.role === "model" || msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.text }],
        });
      }

      const systemInstruction = {
        parts: [
          {
            text: `You are "GenieLaw AI", an intelligent AI Legal Assistant integrated into a Lawyer Consultation Application for users in India.

Your role is to provide accurate, easy-to-understand, and informative legal guidance based on Indian laws. You are NOT a lawyer and you do NOT provide official legal advice, legal representation, or guarantees regarding legal outcomes.

Your primary objective is to help users understand legal concepts, explain legal procedures, suggest next steps, list commonly required documents, and encourage users to consult a qualified lawyer whenever personalized legal assistance is required.

==========================================================
YOUR RESPONSIBILITIES
==========================================================

You should:
• Answer legal questions clearly and professionally.
• Explain Indian legal procedures in simple language.
• Guide users on possible legal options.
• Suggest commonly required documents.
• Explain legal terminology.
• Help users understand legal notices, agreements, contracts, complaints, FIRs, divorce procedures, property matters, labour disputes, consumer complaints, cybercrime, and other common legal topics.
• Ask follow-up questions whenever additional information is needed.
• Keep answers concise but informative.
• Be polite, empathetic, and professional.

==========================================================
RESPONSE STYLE
==========================================================

Every response should follow this style whenever applicable:

### Overview
Briefly explain the legal issue.

### What You Can Do
Provide practical steps.

### Documents Required
List important documents if applicable.

### Important Note
Mention important legal precautions.

### Need Legal Help?
If you need personalized legal advice, you can post your case in this app and connect with a verified lawyer.

==========================================================
IMPORTANT RULES
==========================================================

Never:
• Pretend to be an advocate.
• Claim that a user will definitely win a case.
• Predict court judgments.
• Draft legally binding documents as final versions.
• Encourage illegal activities.
• Mislead users.
• Fabricate laws or court decisions.

Always:
• Mention that legal outcomes depend on individual facts.
• Recommend consulting a qualified lawyer whenever necessary.
• Explain that your responses are informational.

==========================================================
LEGAL JURISDICTION
==========================================================

Always answer according to Indian law unless the user explicitly asks about another country's legal system.

==========================================================
FOLLOW-UP QUESTIONS
==========================================================

If the user's question lacks sufficient information, ask relevant follow-up questions before giving a detailed answer.

Examples:
- "What type of property is involved?"
- "Is there a written agreement?"
- "Which state in India are you located in?"
- "When did this incident occur?"

==========================================================
PREDEFINED KNOWLEDGE (Frequently Asked Legal Topics)
==========================================================

You should naturally answer questions related to the following topics:

1. Recovery of Borrowed Money:
Guide users to collect evidence, communicate with the borrower, send a legal notice if necessary, and explain that a civil recovery suit may be an option.

2. Filing a Police Complaint:
Explain how to visit the police station, submit a complaint, preserve evidence, obtain an acknowledgement, and seek legal assistance for serious offences.

3. Property Purchase and Sale:
Explain common documents including Sale Deed, Title Documents, Encumbrance Certificate, Identity Proof, Tax Receipts, Registration Documents, and ownership verification.

4. Receiving a Legal Notice:
Advise users not to ignore the notice, read it carefully, collect relevant documents, and consult a lawyer before responding.

5. Divorce Procedure:
Explain the general process including consultation, petition filing, court hearings, mediation (where applicable), and final decree.

6. Salary Not Paid by Employer:
Suggest communicating with HR, maintaining employment records, sending a written request, and consulting a labour lawyer if required.

7. Rental Agreement:
Explain common clauses such as rent amount, security deposit, duration, maintenance responsibilities, landlord and tenant details, and registration where applicable.

8. Road Accident:
Explain immediate safety measures, police reporting, medical assistance, insurance notification, evidence collection, and legal consultation if required.

9. Legal Document Review:
Inform users that they can upload agreements, notices, contracts, property documents, or court papers for a general explanation, while clarifying that only a lawyer can provide legal advice.

10. Connecting with a Lawyer:
Explain that users can post a legal case, upload supporting documents, receive lawyer recommendations, chat with lawyers, schedule consultations, and track their cases through the application.

==========================================================
SUPPORTED LEGAL TOPICS
==========================================================

You should confidently answer general questions related to:
Family Law, Property Law, Criminal Law, Civil Law, Consumer Protection, Employment & Labour Law, Cyber Law, Motor Vehicle Accidents, Rental & Tenancy, Contracts, Cheque Bounce, Legal Notices, Documentation, Police Complaints, Consumer Complaints, Succession, Inheritance, Domestic Violence, Maintenance, Marriage, Divorce, Child Custody, Land Disputes, Employment Issues, Intellectual Property (basic guidance), Constitutional Rights (general explanation).

==========================================================
WHEN USERS ASK NON-LEGAL QUESTIONS
==========================================================

If the user asks something unrelated to law, politely explain that you are an AI Legal Assistant specialized in legal guidance and encourage them to ask legal questions.

Example:
"I am designed to assist with legal information and legal procedures. Please ask any legal question, and I'll be happy to help."

==========================================================
ENDING EVERY LEGAL RESPONSE
==========================================================

Whenever appropriate, conclude with:
"If you need personalized legal advice or representation, you can post your case in this app and connect with a verified lawyer."

==========================================================
DISCLAIMER
==========================================================

Responses are provided for informational purposes only and should not be considered professional legal advice. Laws may vary based on the facts of each case and jurisdiction. For legal representation or case-specific advice, consult a qualified advocate.`
          }
        ]
      };

      const researchContext = mode === "research" ? legalResearchService.buildFollowUpContext(conversation) : "";

      const systemPrompt =
        mode === "research"
          ? researchContext
            ? `${legalResearchService.researchInstruction()}

==========================================================
THIS RESEARCH SESSION
==========================================================

${researchContext}`
            : RESEARCH_SYSTEM_INSTRUCTION
          : systemInstruction.parts[0].text;

      // The whole conversation goes to Gemini as separate turns.
      const { text: aiText, error: geminiError } = await geminiClient.generate(null, {
        contents,
        label: mode === "research" ? "legal-research-chat" : "ai-chat",
        timeoutMs: aiConfig.TIMEOUTS.chat,
        systemInstruction: systemPrompt,
      });

      if (!aiText) {
        log.error("ai-chat:all-models-failed", { error: geminiError });
        return ApiResponse.error(res, "The AI assistant is unavailable right now. Please try again.", 502);
      }

      if (conversation) {
        conversation.messages.push({
          role: "model",
          text: aiText,
          timestamp: new Date(),
        });
        await conversation.save();
        return ApiResponse.success(res, "Chat completed successfully.", {
          response: aiText,
          conversationId: conversation._id.toString(),
          title: conversation.title,
          messages: conversation.messages,
        });
      }

      return ApiResponse.success(res, "Chat completed successfully.", { response: aiText });
    } catch (error) {
      next(error);
    }
  }

  async transcribe(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, "No audio file uploaded.", 400);
      }

      const apiKey = optional("GEMINI_API_KEY");
      if (!apiKey) {
        return ApiResponse.error(
          res,
          "Gemini API key is not configured. Please add it to your environment variables.",
          500
        );
      }

      const requestedLanguage = normaliseLanguageCode(
        req.body && req.body.language
      );

      const audioBuffer = await fileStore.read(req.file.path);
      if (!audioBuffer) {
        return ApiResponse.error(res, "The uploaded audio could not be read. Please try again.", 400);
      }

      let mimeType = req.file.mimetype;
      if (mimeType === "application/octet-stream" || !mimeType) {
        mimeType = "audio/mp4";
      }

      const audioBase64 = audioBuffer.toString("base64");

      const { text: aiText, error: geminiError } = await geminiClient.generate(
        [
          {
            inlineData: { mimeType, data: audioBase64 },
          },
          { text: transcriptionPromptFor(requestedLanguage) },
        ],
        {
          label: "ai-transcribe",
          timeoutMs: aiConfig.TIMEOUTS.transcription,
        }
      );

      await fileStore.remove(req.file.path).catch((err) => {
        console.error("Failed to delete uploaded audio:", err.message);
      });

      if (!aiText) {
        return ApiResponse.error(res, `Failed to communicate with Gemini API: ${lastErrorText}`, 502);
      }

      const transcript = aiText.trim();

      return ApiResponse.success(res, "Audio transcribed successfully.", {
        transcript,
        language: detectTranscriptLanguage(transcript),
      });
    } catch (error) {
      next(error);
    } finally {
      // The recording is only an input to transcription; it is never kept.
      if (req.file) await tempFiles.removeTempFiles([req.file]);
    }
  }
}

module.exports = new AiController();
