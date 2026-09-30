const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Document = require("../models/Document");
const Case = require("../models/Case");
const Message = require("../models/Message");
const sessionService = require("../services/auth/sessionService");
const { required } = require("../config/env");

const PUBLIC_FOLDERS = new Set(["profiles"]);

// Matches a stored link ending in exactly this file name ("/uploads/x/<name>",
// optionally with a query string). The name comes from the URL, so it is
// escaped: it must never act as a pattern (".*" would match any file).
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const endsWithFile = (fileName) => new RegExp(`/${escapeRegex(fileName)}(?:[?#].*)?$`);

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }

  const query = req.query.token;
  if (Array.isArray(query)) {
    const last = query.filter((v) => typeof v === "string" && v).pop();
    return last || null;
  }

  return typeof query === "string" && query ? query : null;
};

const canReadFile = async (user, relativePath, fileName) => {
  if (user.role === "admin") return true;

  const document = await Document.findOne({ filePath: relativePath });
  if (document) {
    if (document.clientId.toString() === user._id.toString()) return true;
    if (user.role !== "lawyer") return false;

    // A document submitted with a case is visible to that case's lawyers only.
    const engaged = await Case.exists({
      ...(document.caseId ? { _id: document.caseId } : {}),
      client: document.clientId,
      $or: [
        { assignedLawyer: user._id },
        { selectedLawyer: user._id },
        { lawyerRequests: { $elemMatch: { lawyer: user._id, status: "Pending" } } },
      ],
    });
    return Boolean(engaged);
  }

  const relatedCase = await Case.findOne({
    $or: [
      { "documents.url": { $regex: endsWithFile(fileName) } },
      { voiceUrl: { $regex: endsWithFile(fileName) } },
    ],
  }).select("client assignedLawyer selectedLawyer lawyerRequests");

  if (relatedCase) {
    const pendingInvitees = (relatedCase.lawyerRequests || [])
      .filter((r) => r.status === "Pending")
      .map((r) => r.lawyer);
    return [
      relatedCase.client,
      relatedCase.assignedLawyer,
      relatedCase.selectedLawyer,
      ...pendingInvitees,
    ]
      .filter(Boolean)
      .some((id) => id.toString() === user._id.toString());
  }

  const message = await Message.findOne({
    "attachments.url": { $regex: endsWithFile(fileName) },
  }).populate("chat");

  if (message && message.chat && Array.isArray(message.chat.participants)) {
    return message.chat.participants.some(
      (id) => id.toString() === user._id.toString()
    );
  }

  return false;
};

const fileAuthMiddleware = async (req, res, next) => {
  const segments = req.path.split("/").filter(Boolean);
  const [folder, fileName] = segments;

  if (PUBLIC_FOLDERS.has(folder)) {
    return next();
  }

  if (!folder || !fileName || segments.length !== 2) {
    return res.status(404).json({ success: false, message: "Not found." });
  }

  const token = extractToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, required("JWT_SECRET"));
    // A signed-out session (logout / logout everywhere) no longer opens files.
    if (decoded.sid && !(await sessionService.isSessionActive(decoded.sid))) {
      return res.status(401).json({ success: false, message: "Your session has ended. Please sign in again." });
    }
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    const relativePath = `uploads/${folder}/${fileName}`;
    if (!(await canReadFile(user, relativePath, fileName))) {
      return res.status(404).json({ success: false, message: "Not found." });
    }

    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token." });
  }
};

module.exports = fileAuthMiddleware;
