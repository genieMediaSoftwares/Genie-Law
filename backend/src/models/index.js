// Mongoose models for MongoDB Atlas. Each model keeps the collection name of
// the table it had on Cloudflare D1 (users, cases, ...), so data migrated by
// scripts/migration/migrateCloudflareLocal.js lands where the code expects it.

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const encryptedPaths = require("./plugins/encryptedPaths");
const { generateId } = require("./ids");

const { Schema, model } = mongoose;
const { ObjectId, Mixed } = Schema.Types;

// Responses keep the shape they had before: no __v version key, and Map
// fields (e.g. extractedData.confidence) serialised as plain objects.
mongoose.plugin((schema) => schema.set("versionKey", false));
mongoose.set("toJSON", { flattenMaps: true });
mongoose.set("toObject", { flattenMaps: true });

const SUBSCRIPTION_PLANS = ["Free", "Starter", "Professional", "Premium", "Elite", "Basic", "Pro Hub"];
const REQUIRED_LAWYER_COUNT = 3;
const LAWYER_REQUEST_STATUSES = ["Pending", "Accepted", "Declined", "Unavailable"];
const LEGAL_DOCUMENT_TYPES = [
  "platform_terms",
  "client_terms",
  "lawyer_terms",
  "privacy_policy",
  "refund_policy",
  "ai_disclaimer",
  "communication_consent",
  "document_sharing_consent",
];
const AUDIENCES = ["all", "client", "lawyer"];

// --- User ------------------------------------------------------------------

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Required for email/password signups (validations/authValidation); absent
    // for accounts created with Google, which add it later.
    mobile: { type: String, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["client", "lawyer", "admin"], default: "client" },
    profileImage: { type: String, default: "" },
    location: { type: String, default: "" },
    dob: { type: String, default: "" },
    gender: { type: String, default: "" },
    languages: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpire: { type: Date, default: null },
    // Contact verification (services/auth/otp). New signups must verify their
    // email OR mobile before signing in; older accounts have no requirement.
    requiresContactVerification: { type: Boolean, default: null },
    emailVerifiedAt: { type: Date, default: null },
    mobileVerifiedAt: { type: Date, default: null },
    // Google sign-in (services/auth/googleAuthService).
    googleId: { type: String },
    googleLinkedAt: { type: Date, default: null },
    authProviders: { type: [String], default: [] },
  },
  { timestamps: true, collection: "users" }
);
// Unique when present. Accounts created with Google have no mobile and most
// accounts have no googleId, so absent values must not collide (as on D1,
// where a unique column allowed any number of NULLs).
userSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: "string" } } });
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: "string" } } });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// --- Auth: OTP codes and OAuth flows ----------------------------------------

const authOtpSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    channel: { type: String, enum: ["email", "mobile"], required: true },
    destination: { type: String, required: true },
    codeHash: { type: String, required: true, select: false },
    salt: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    invalidatedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "auth_otps" }
);
authOtpSchema.index({ user: 1, channel: 1, createdAt: -1 });

const oauthFlowSchema = new Schema(
  {
    provider: { type: String, enum: ["google"], required: true },
    stateHash: { type: String, required: true, unique: true },
    role: { type: String, enum: ["client", "lawyer"], required: true },
    appRedirect: { type: String, required: true },
    codeVerifier: { type: String, required: true, select: false },
    nonce: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    callbackAt: { type: Date, default: null },
    user: { type: ObjectId, ref: "User" },
    exchangeHash: { type: String, index: true },
    exchangeExpiresAt: { type: Date, default: null },
    exchangedAt: { type: Date, default: null },
    error: { type: String, default: "" },
  },
  { timestamps: true, collection: "oauth_flows" }
);

// --- Lawyer ----------------------------------------------------------------

const lawyerSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, unique: true },
    specialization: { type: String, required: true },
    experience: { type: Number, default: 0 },
    education: { type: String, default: "" },
    barCouncilNumber: { type: String, default: "" },
    languages: [{ type: String }],
    consultationFee: { type: Number, default: 0 },
    bio: { type: String, default: "" },
    officeAddress: { type: String, default: "" },
    availability: [{ day: String, startTime: String, endTime: String }],
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    upiId: { type: String, default: "" },
    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
    },
    barCertificate: { type: String, default: "" },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    subscriptionPlan: { type: String, enum: SUBSCRIPTION_PLANS, default: "Free" },
    googleConnected: { type: Boolean, default: false },
    googleEmail: { type: String, default: "" },
    googleAccessToken: { type: String, default: "" },
    googleRefreshToken: { type: String, default: "" },
    googleTokenExpiry: { type: Date },
    workingHours: { type: String, default: "" },
    casesHandled: { type: Number, default: 0 },
    winPercentage: { type: Number, default: 0 },
    responseTime: { type: String, default: "" },
    district: { type: String, default: "" },
    practiceAreas: { type: [String], default: [] },
  },
  {
    timestamps: true,
    collection: "lawyers",
  }
);
// Stored encrypted, returned decrypted (utils/cryptoUtil).
lawyerSchema.plugin(encryptedPaths, { paths: ["upiId", "bankDetails.accountNumber"] });
lawyerSchema.index({ rating: -1 });
lawyerSchema.index({ experience: -1 });
lawyerSchema.index({ specialization: 1, rating: -1 });

// --- Client ----------------------------------------------------------------

const clientSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, unique: true },
    address: { type: String, default: "" },
    preferredLanguages: [{ type: String }],
    notes: [
      {
        lawyer: { type: ObjectId, ref: "User" },
        text: String,
        date: { type: Date, default: Date.now },
        case: { type: ObjectId, ref: "Case", default: null },
        title: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, collection: "clients" }
);

// --- RefreshToken ----------------------------------------------------------

const refreshTokenSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    refreshTokenHash: { type: String, default: "", index: true },
    deviceInfo: { type: String, default: "unknown" },
    deviceName: { type: String, default: "" },
    platform: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    ipAddress: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "refresh_tokens" }
);
refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

// --- Case ------------------------------------------------------------------

const caseSchema = new Schema(
  {
    client: { type: ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: { type: String, default: "" },
    location: { type: String, required: true },
    locationCity: { type: String, default: "" },
    locationDistrict: { type: String, default: "" },
    locationState: { type: String, default: "" },
    locationCountry: { type: String, default: "" },
    locationLatitude: { type: Number, default: 0.0 },
    locationPlaceId: { type: String, default: "" },
    locationLongitude: { type: Number, default: 0.0 },
    preferredCourt: { type: String, default: "" },
    incidentDate: { type: Date, default: null },
    opposingParty: { type: String, default: "" },
    firNumber: { type: String, default: "" },
    policeStation: { type: String, default: "" },
    bailDetails: { type: String, default: "" },
    budgetRange: { type: String, default: "" },
    urgency: { type: String, default: "Flexible" },
    status: {
      type: String,
      enum: [
        "Submitted",
        "Awaiting Lawyer Acceptance",
        "Pending Lawyer Response",
        "Interested",
        "Accepted",
        "In Progress",
        "Completed",
        "Closed",
        "Rejected",
      ],
      default: "Submitted",
    },
    documents: [{ name: String, url: String, size: String }],
    proposals: [
      {
        lawyer: { type: ObjectId, ref: "User" },
        feeProposal: { type: Number, required: true },
        message: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    selectedLawyer: { type: ObjectId, ref: "User" },
    assignedLawyer: { type: ObjectId, ref: "User" },
    lawyerRequests: {
      type: [
        {
          _id: false,
          lawyer: { type: ObjectId, ref: "User", required: true },
          status: { type: String, enum: LAWYER_REQUEST_STATUSES, default: "Pending" },
          createdAt: { type: Date, default: Date.now },
          respondedAt: { type: Date, default: null },
          acceptedAt: { type: Date, default: null },
        },
      ],
      default: [],
      validate: {
        validator: (requests) => {
          if (requests.length === 0) return true;
          const ids = new Set(requests.map((r) => String(r.lawyer)));
          return requests.length === REQUIRED_LAWYER_COUNT && ids.size === requests.length;
        },
        message: `Exactly ${REQUIRED_LAWYER_COUNT} different lawyers must be selected.`,
      },
    },
    clientRequestId: { type: String, default: undefined },
    milestones: [
      {
        title: { type: String, required: true },
        date: { type: Date, default: Date.now },
        isCompleted: { type: Boolean, default: false },
      },
    ],
    caseOutcome: { type: String, default: "" },
    claimAmount: { type: String, default: "" },
    consultationDate: { type: Date, default: null },
    nextHearing: { type: Date, default: null },
    hearings: [
      {
        date: { type: Date, required: true },
        timeSlot: { type: String, default: "" },
        court: { type: String, default: "" },
        purpose: { type: String, default: "" },
        status: { type: String, enum: ["scheduled", "completed", "adjourned", "cancelled"], default: "scheduled" },
        notes: { type: String, default: "" },
        createdBy: { type: ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    closedDate: { type: Date, default: null },
    rating: { type: Number, default: 0 },
    review: { type: String, default: "" },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    voiceUrl: { type: String, default: "" },
    voiceTranscript: { type: String, default: "" },
  },
  { timestamps: true, collection: "cases" }
);
caseSchema.index({ client: 1, status: 1, createdAt: -1 });
caseSchema.index({ assignedLawyer: 1, status: 1 });
caseSchema.index({ category: 1, locationCity: 1 });
caseSchema.index({ locationState: 1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ updatedAt: -1 });
caseSchema.index(
  { client: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

// --- Appointment -----------------------------------------------------------

const appointmentSchema = new Schema(
  {
    client: { type: ObjectId, ref: "User", required: true },
    lawyer: { type: ObjectId, ref: "User", required: true },
    case: { type: ObjectId, ref: "Case" },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    mode: { type: String, enum: ["Chat", "In-Person"], default: "Chat" },
    status: { type: String, enum: ["pending", "confirmed", "completed", "cancelled"], default: "pending" },
    googleCalendarEventId: { type: String, default: "" },
    meetingLink: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "appointments" }
);
appointmentSchema.index({ client: 1, date: -1 });
appointmentSchema.index({ lawyer: 1, date: -1 });

// --- Chat / Message ----------------------------------------------------------

const chatSchema = new Schema(
  {
    participants: [{ type: ObjectId, ref: "User", required: true }],
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSender: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "chats" }
);
chatSchema.index({ lastMessageAt: -1 });

const messageSchema = new Schema(
  {
    chat: { type: ObjectId, ref: "Chat", required: true },
    sender: { type: ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        mimeType: { type: String },
        size: { type: Number },
      },
    ],
    clientId: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "messages" }
);
messageSchema.index({ chat: 1, createdAt: 1 });
messageSchema.index({ chat: 1, isRead: 1, sender: 1 });

// --- Document / Issue ------------------------------------------------------

const documentSchema = new Schema(
  {
    clientId: { type: ObjectId, ref: "User", required: true },
    issueId: { type: ObjectId, ref: "Issue", default: null },
    // Set when the document was stored by a case submission.
    caseId: { type: ObjectId, ref: "Case", default: null },
    originalName: { type: String, required: true },
    name: { type: String, default: "", trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    contentUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "documents" }
);
documentSchema.index({ clientId: 1, createdAt: -1 });
documentSchema.index({ caseId: 1 });

const fileEntry = { name: String, url: String, size: String, path: String };
const issueSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    documents: [fileEntry],
    images: [fileEntry],
    clientId: { type: ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["Pending", "Assigned", "Resolved", "Closed"], default: "Pending" },
    urgency: { type: String, default: "Flexible" },
    preferredLanguage: { type: String, default: "English" },
    location: { type: String, default: "" },
    preferredMode: { type: String, enum: ["Video", "Chat", "Phone"], default: "Video" },
  },
  { timestamps: true, collection: "issues" }
);

// --- Notification ------------------------------------------------------------

const notificationSchema = new Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      default: () => generateId(),
    },
    senderId: { type: ObjectId, ref: "User", default: null },
    receiverId: { type: ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        "case_posted",
        "proposal_received",
        "proposal_accepted",
        "proposal_rejected",
        "appointment_requested",
        "appointment_confirmed",
        "appointment_cancelled",
        "chat_message",
        "payment_success",
        "payment_failure",
        "case_status_updated",
        "document_uploaded",
        "profile_verification",
        "review_received",
        "admin_announcement",
        "admin_broadcast",
        "case_update",
        "dispute_created",
        "subscription_success",
        "reminder",
        "general",
      ],
      default: "general",
    },
    priority: { type: String, enum: ["low", "medium", "high"], default: "low" },
    metadata: { type: Mixed, default: {} },
    referenceId: { type: String, default: null },
    isRead: { type: Boolean, default: false, index: true },
    softDelete: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: "notifications" }
);
notificationSchema.index({ receiverId: 1, softDelete: 1, createdAt: -1 });

// --- Proposal / Review -------------------------------------------------------

const proposalSchema = new Schema(
  {
    caseId: { type: ObjectId, ref: "Case", required: true },
    lawyerId: { type: ObjectId, ref: "User", required: true },
    clientId: { type: ObjectId, ref: "User", required: true },
    consultationFee: { type: Number, required: true },
    proposalMessage: { type: String, required: true },
    availability: { type: String, required: true },
    consultationMode: { type: String, enum: ["Online", "Offline", "Video"], required: true },
    estimatedResponseTime: { type: String, default: "24 hours" },
    status: { type: String, enum: ["Pending", "Accepted", "Rejected"], default: "Pending" },
  },
  { timestamps: true, collection: "proposals" }
);
proposalSchema.index({ caseId: 1 });
proposalSchema.index({ lawyerId: 1 });
proposalSchema.index({ clientId: 1 });

const reviewSchema = new Schema(
  {
    lawyer: { type: ObjectId, ref: "User", required: true },
    client: { type: ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true },
    reply: { type: String, default: "" },
    replyDate: { type: Date },
    isHidden: { type: Boolean, default: false },
    isReported: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "reviews" }
);
reviewSchema.index({ lawyer: 1, createdAt: -1 });
// One review per client per lawyer, enforced by the database as well as the controller.
reviewSchema.index({ lawyer: 1, client: 1 }, { unique: true });

// --- Payments, subscriptions, transactions -----------------------------------

const paymentSchema = new Schema(
  {
    client: { type: ObjectId, ref: "User", required: true },
    lawyer: { type: ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    // Lowercase stored status; services/payment/paymentStates maps it to the API state.
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled", "refunded", "expired"],
      default: "pending",
    },
    paymentMethod: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    purpose: { type: String, enum: ["consultation", "subscription"], default: "consultation" },
    // Gateway-neutral references (set by the gateway adapter).
    gateway: { type: String, default: "" },
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: { type: String },
    failureReason: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    appointment: { type: ObjectId, ref: "Appointment" },
    case: { type: ObjectId, ref: "Case" },
    subscriptionPlan: { type: String },
  },
  { timestamps: true, collection: "payments" }
);

const subscriptionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    plan: { type: String, enum: SUBSCRIPTION_PLANS, default: "Free" },
    status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
  },
  { timestamps: true, collection: "subscriptions" }
);
subscriptionSchema.index({ user: 1, status: 1 });

const transactionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["credit", "debit", "withdrawal"], required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "completed" },
  },
  { timestamps: true, collection: "transactions" }
);
transactionSchema.index({ user: 1, createdAt: -1 });

const webhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    status: { type: String, enum: ["processing", "processed", "failed"], default: "processing" },
    payload: { type: Mixed },
    errorMessage: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true, collection: "webhook_events" }
);

// --- Milestone ---------------------------------------------------------------

const milestoneSchema = new Schema(
  {
    caseId: { type: ObjectId, ref: "Case", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["pending", "in_progress", "completed", "cancelled"], default: "pending" },
    dueDate: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: ObjectId, ref: "User", required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "milestones" }
);
milestoneSchema.index({ caseId: 1, order: 1 });

// --- Catalogue: categories, courts, FAQs, favourites, calendar ---------------

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "categories" }
);

const courtSchema = new Schema(
  {
    courtName: { type: String, required: true, trim: true },
    courtType: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    courtAddress: { type: String, required: true },
    pincode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "courts" }
);
courtSchema.index({ city: 1 });

const faqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: "faqs" }
);

const favoriteSchema = new Schema(
  {
    client: { type: ObjectId, ref: "User", required: true },
    lawyer: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "favorites" }
);
favoriteSchema.index({ client: 1, lawyer: 1 });

const calendarEventSchema = new Schema(
  {
    lawyer: { type: ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ["holiday", "blocked_date", "personal_event"], default: "blocked_date" },
    date: { type: Date, required: true },
    timeSlot: { type: String },
  },
  { timestamps: true, collection: "calendar_events" }
);
calendarEventSchema.index({ lawyer: 1, date: 1 });

// --- Legal documents -----------------------------------------------------------

const legalDocumentSchema = new Schema(
  {
    type: { type: String, enum: LEGAL_DOCUMENT_TYPES, required: true },
    version: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    effectiveDate: { type: Date, required: true },
    audience: { type: String, enum: AUDIENCES, default: "all" },
    isActive: { type: Boolean, default: false },
    requiresAcceptance: { type: Boolean, default: false },
    legallyReviewed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "legal_documents" }
);
legalDocumentSchema.index({ type: 1, version: 1 }, { unique: true });
legalDocumentSchema.index({ type: 1, isActive: 1 });

const legalAcceptanceSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    document: { type: ObjectId, ref: "LegalDocument", required: true },
    documentType: { type: String, required: true },
    version: { type: String, required: true },
    acceptedAt: { type: Date, default: Date.now },
    appVersion: { type: String, default: "" },
  },
  { timestamps: true, collection: "legal_acceptances" }
);
legalAcceptanceSchema.index({ user: 1, documentType: 1, version: 1 }, { unique: true });

// --- Promotions, referrals, settings, audit ------------------------------------

const promotionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    code: { type: String, required: true, uppercase: true, unique: true },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    applicableTo: { type: String, enum: ["consultation", "subscription", "both"], default: "consultation" },
    eligibleCategory: { type: String, default: "" },
    eligiblePlan: { type: String, enum: [...SUBSCRIPTION_PLANS, ""], default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    maxUses: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    maxUsesPerUser: { type: Number, default: 1 },
    minAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "promotions" }
);

const referralSchema = new Schema(
  {
    referrer: { type: ObjectId, ref: "User", required: true },
    referee: { type: ObjectId, ref: "User", required: true },
    refereeName: { type: String, required: true },
    refereeEmail: { type: String, required: true },
    refereePhone: { type: String, default: "" },
    referrerRole: { type: String, enum: ["client", "lawyer", "admin"], required: true },
    status: { type: String, enum: ["pending", "accepted", "registered", "completed"], default: "pending" },
    referralCode: { type: String, required: true },
    referralLink: { type: String, default: "" },
    source: { type: String, default: "link" },
    registeredAt: { type: Date },
    completedAt: { type: Date },
    metadata: { type: Mixed, default: {} },
  },
  { timestamps: true, collection: "referrals" }
);
referralSchema.index({ referralCode: 1 });
referralSchema.index({ referrer: 1, createdAt: -1 });

const settingSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, unique: true },
    pushNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    language: { type: String, default: "English" },
    twoFactorAuthentication: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "settings" }
);

const auditLogSchema = new Schema(
  {
    performedBy: { type: ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true },
    targetModel: { type: String, default: "" },
    targetId: { type: String, default: "" },
    details: { type: Mixed, default: {} },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true, collection: "audit_logs" }
);
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

// --- AI ----------------------------------------------------------------------

const aiMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "model", "assistant"], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const aiConversationSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, default: "New Legal Conversation" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    mode: { type: String, enum: ["chat", "research"], default: "chat" },
    messages: [aiMessageSchema],
    caseId: { type: ObjectId, ref: "Case", default: null },
    caseTitle: { type: String, default: "" },
    jurisdiction: { type: String, default: "" },
    researchDocuments: [
      {
        _id: false,
        documentId: { type: String, required: true },
        name: { type: String, default: "" },
        reference: { type: String, default: "" },
        status: {
          type: String,
          enum: ["pending", "used", "truncated", "failed", "unsupported", "missing"],
          required: true,
        },
        charCount: { type: Number, default: 0 },
        note: { type: String, default: "" },
      },
    ],
    documentContext: { type: String, default: "", select: false },
    researchStatus: { type: String, enum: ["idle", "processing", "completed", "failed"], default: "idle" },
    researchStage: { type: String, default: "" },
    researchError: { type: String, default: "" },
    relevantCases: {
      status: {
        type: String,
        enum: ["idle", "searching", "completed", "failed", "unavailable"],
        default: "idle",
      },
      query: { type: String, default: "" },
      jurisdiction: { type: String, default: "" },
      provider: { type: String, default: "" },
      searchedAt: { type: Date, default: null },
      message: { type: String, default: "" },
      results: [
        {
          _id: false,
          caseTitle: { type: String, required: true },
          citation: { type: String, default: "" },
          court: { type: String, default: "" },
          jurisdiction: { type: String, default: "" },
          decisionDate: { type: String, default: "" },
          relevanceSummary: { type: String, default: "" },
          legalPrinciple: { type: String, default: "" },
          sources: [{ _id: false, url: { type: String, required: true }, name: { type: String, default: "" } }],
          verificationStatus: {
            type: String,
            enum: ["Source Retrieved", "Search Result — Not Yet Verified"],
            required: true,
          },
          retrievedAt: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true, collection: "ai_conversations" }
);
aiConversationSchema.index({ userId: 1, updatedAt: -1 });
aiConversationSchema.index({ userId: 1, mode: 1, updatedAt: -1 });
aiConversationSchema.index({ researchStatus: 1 });

const aiSmartCaseSessionSchema = new Schema(
  {
    client: { type: ObjectId, ref: "User", required: true },
    requestId: { type: String, default: undefined },
    status: { type: String, enum: ["processing", "extracted", "failed"], default: "processing" },
    progress: {
      stage: { type: String, default: "queued" },
      message: { type: String, default: "" },
      percent: { type: Number, default: 0 },
      current: { type: Number, default: null },
      total: { type: Number, default: null },
      updatedAt: { type: Date, default: Date.now },
    },
    failureReason: { type: String, default: "" },
    warnings: { type: [String], default: [] },
    voiceTranscriptionFailed: { type: Boolean, default: false },
    uploadedDocuments: [
      {
        documentId: { type: ObjectId, ref: "Document", default: null },
        originalName: String,
        mimeType: String,
        size: Number,
        path: String,
        url: String,
        documentType: { type: String, default: "Unknown" },
        ocrQuality: { type: String, default: "Good" },
      },
    ],
    ocrExtractedText: { type: String, default: "" },
    voiceTranscript: { type: String, default: "" },
    voiceTranscriptLanguage: { type: String, enum: ["", "en", "hi", "te"], default: "" },
    voiceTranscriptSource: { type: String, enum: ["none", "live", "server"], default: "none" },
    serverVoiceTranscript: { type: String, default: "" },
    extractedData: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      category: { type: String, default: "" },
      categoryId: { type: String, default: "" },
      subType: { type: String, default: "" },
      urgency: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      location: { type: String, default: "" },
      court: { type: String, default: "" },
      incidentDate: { type: Date, default: null },
      opposingParty: { type: String, default: "" },
      firNumber: { type: String, default: "" },
      policeStation: { type: String, default: "" },
      bailDetails: { type: String, default: "" },
      claimAmount: { type: Number, default: null },
      documentType: { type: String, default: "" },
      isCriminalLike: { type: Boolean, default: false },
      summary: { type: String, default: "" },
      parties: [{ name: { type: String, default: "" }, role: { type: String, default: "" } }],
      confidence: { type: Map, of: Number, default: {} },
      needsReview: { type: [String], default: [] },
    },
    createdCase: { type: ObjectId, ref: "Case" },
  },
  { timestamps: true, collection: "ai_smart_case_sessions" }
);
aiSmartCaseSessionSchema.index({ client: 1, updatedAt: -1 });
aiSmartCaseSessionSchema.index({ status: 1 });
aiSmartCaseSessionSchema.index(
  { client: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: "string" } } }
);

module.exports = {
  User: model("User", userSchema),
  AuthOtp: model("AuthOtp", authOtpSchema),
  OAuthFlow: model("OAuthFlow", oauthFlowSchema),
  Lawyer: model("Lawyer", lawyerSchema),
  Client: model("Client", clientSchema),
  RefreshToken: model("RefreshToken", refreshTokenSchema),
  Case: model("Case", caseSchema),
  Appointment: model("Appointment", appointmentSchema),
  Chat: model("Chat", chatSchema),
  Message: model("Message", messageSchema),
  Document: model("Document", documentSchema),
  Issue: model("Issue", issueSchema),
  Notification: model("Notification", notificationSchema),
  Proposal: model("Proposal", proposalSchema),
  Review: model("Review", reviewSchema),
  Payment: model("Payment", paymentSchema),
  Subscription: model("Subscription", subscriptionSchema),
  Transaction: model("Transaction", transactionSchema),
  WebhookEvent: model("WebhookEvent", webhookEventSchema),
  Milestone: model("Milestone", milestoneSchema),
  Category: model("Category", categorySchema),
  Court: model("Court", courtSchema),
  FAQ: model("FAQ", faqSchema),
  Favorite: model("Favorite", favoriteSchema),
  CalendarEvent: model("CalendarEvent", calendarEventSchema),
  LegalDocument: model("LegalDocument", legalDocumentSchema),
  LegalAcceptance: model("LegalAcceptance", legalAcceptanceSchema),
  Promotion: model("Promotion", promotionSchema),
  Referral: model("Referral", referralSchema),
  Setting: model("Setting", settingSchema),
  AuditLog: model("AuditLog", auditLogSchema),
  AiConversation: model("AiConversation", aiConversationSchema),
  AiSmartCaseSession: model("AiSmartCaseSession", aiSmartCaseSessionSchema),
  constants: {
    SUBSCRIPTION_PLANS,
    REQUIRED_LAWYER_COUNT,
    LAWYER_REQUEST_STATUSES,
    LEGAL_DOCUMENT_TYPES,
    AUDIENCES,
  },
};
