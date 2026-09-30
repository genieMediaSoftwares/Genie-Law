const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const fileAuthMiddleware = require("./middleware/fileAuthMiddleware");
const serveUpload = require("./middleware/serveUpload");
const requestTimeout = require("./middleware/requestTimeout");

const errorMiddleware = require("./middleware/errorMiddleware");
const notFoundMiddleware = require("./middleware/notFoundMiddleware");
const authRoutes = require("./routes/authRoutes");
const caseRoutes = require("./routes/case.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const chatRoutes = require("./routes/chat.routes");
const lawyerRoutes = require("./routes/lawyer.routes");
const issueRoutes = require("./routes/issues.routes");
const documentRoutes = require("./routes/document.routes");
const notificationRoutes = require("./routes/notification.routes");
const favoriteRoutes = require("./routes/favorite.routes");
const faqRoutes = require("./routes/faq.routes");
const clientRoutes = require("./routes/client.routes");
const reviewRoutes = require("./routes/review.routes");
const paymentRoutes = require("./routes/payment.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const legalRoutes = require("./routes/legal.routes");
const courtRoutes = require("./routes/court.routes");
const placeRoutes = require("./routes/place.routes");
const aiRoutes = require("./routes/ai.routes");
const adminRoutes = require("./routes/admin.routes");
const categoryRoutes = require("./routes/category.routes");
const promotionRoutes = require("./routes/promotion.routes");
const referralRoutes = require("./routes/referral.routes");
const milestoneRoutes = require("./routes/milestone.routes");
const { required, requiredNumber } = require("./config/env");


const app = express();


// Proxy hops in front of the server (0 = none; 1 on Render, whose load balancer
// sets X-Forwarded-For; add one more for each proxy/CDN placed in front).
const trustProxyHops = requiredNumber("TRUST_PROXY");
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY must be a whole number (0, 1, 2, ...).");
}
app.set("trust proxy", trustProxyHops > 0 ? trustProxyHops : false);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

const { corsOptions } = require("./config/cors");
app.use(cors(corsOptions));

const { requestContext } = require("./middleware/requestContext");
app.use(requestContext());

const authLimiter = (max, windowMinutes, options = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many attempts. Please try again later.",
      code: "RATE_LIMITED",
    },
    ...options,
  });

app.use(
  "/api/auth/login",
  authLimiter(60, 15, {
    skipSuccessfulRequests: true,
  })
);
app.use("/api/auth/signup", authLimiter(20, 60));
app.use("/api/auth/otp/request", authLimiter(20, 60));
app.use("/api/auth/otp/verify", authLimiter(30, 15));
app.use("/api/auth/google", authLimiter(30, 15));
app.use("/api/auth/forgot-password", authLimiter(10, 15));
app.use("/api/auth/reset-password", authLimiter(10, 15));

app.use(
  "/api",
  authLimiter(3000, 15, {
    skip: (req) => req.path.startsWith("/auth/"),
  })
);

app.use(compression());

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// Hard timeout for ordinary API requests. Uploads, downloads, AI, and
// Socket.IO paths opt out inside requestTimeout().
app.use(requestTimeout());

// File links carry the session token as ?token=; never write it to the logs.
morgan.token("url", (req) => (req.originalUrl || req.url).replace(/([?&]token=)[^&]*/gi, "$1[REDACTED]"));
app.use(morgan(required("NODE_ENV") === "production" ? "combined" : "dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 Lawyer Consultation Backend Running Successfully",
    version: "1.0.0",
    environment: required("NODE_ENV"),
  });
});

// Reverse proxies send requests over body size limits here (error_page 413),
// so the browser gets a readable JSON 413 with the normal CORS headers instead
// of an opaque CORS failure.
app.all("/api/errors/payload-too-large", (req, res) => {
  res.status(413).json({
    success: false,
    message: "This file is larger than the server accepts for this request.",
    code: "PAYLOAD_TOO_LARGE",
  });
});

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 Lawyer Consultation API Running Successfully",
  });
});

app.use("/uploads", fileAuthMiddleware, serveUpload);

app.use("/api/auth", authRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/lawyers", lawyerRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/legal", legalRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/places", placeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/milestones", milestoneRoutes);

// ---- Observability endpoints ----
const { liveness, readiness } = require("./observability/health");
const { renderPrometheus } = require("./observability/metrics");

app.get("/health", (req, res) => {
  const result = liveness();
  res.setHeader("Cache-Control", "no-store");
  res.status(result.ok ? 200 : 503).json(result);
});

app.get("/health/ready", async (req, res) => {
  const result = await readiness();
  res.setHeader("Cache-Control", "no-store");
  res.status(result.ok ? 200 : 503).json(result);
});

app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(renderPrometheus());
});

app.use(notFoundMiddleware);

app.use(errorMiddleware);

module.exports = app;