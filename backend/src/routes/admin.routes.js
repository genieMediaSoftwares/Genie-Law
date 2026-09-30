const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const adminController = require("../controllers/admin/adminController");

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

// Dashboard & Analytics
router.get("/stats", adminController.getAdminDashboardStats);
router.get("/analytics", adminController.getAnalyticsData);
router.get("/reports", adminController.getReportData);
router.get("/ai-analytics", adminController.getAiAnalytics);

// Clients
router.get("/clients", adminController.getClients);
router.get("/clients/:clientId", adminController.getClientById);
router.put("/clients/:clientId/status", adminController.updateClientStatus);

// Lawyers & Verification
router.get("/lawyers", adminController.getLawyers);
router.get("/lawyers/:lawyerId", adminController.getLawyerById);
router.put("/lawyers/:lawyerId/verify", adminController.verifyLawyer);
router.put("/lawyers/:lawyerId/status", adminController.updateLawyerStatus);

// Cases & Urgent Cases
router.get("/cases", adminController.getCases);
router.get("/cases/urgent", adminController.getUrgentCases);
router.get("/cases/:caseId", adminController.getCaseById);
router.put("/cases/:caseId/status", adminController.updateCaseStatus);

// Appointments & Consultations
router.get("/appointments", adminController.getAppointments);
router.get("/consultations", adminController.getAppointments);

// Documents
router.get("/documents", adminController.getDocuments);

// Payments & Refunds
router.get("/payments", adminController.getPayments);
router.get("/payments/config", adminController.getPaymentConfig);
router.post("/payments/:paymentId/refund", adminController.processRefund);

// Subscriptions
router.get("/subscriptions", adminController.getSubscriptions);
router.put("/subscriptions/:subscriptionId", adminController.updateSubscription);

// Reviews & Moderation
router.get("/reviews", adminController.getReviews);
router.put("/reviews/:reviewId/visibility", adminController.updateReviewVisibility);
router.delete("/reviews/:reviewId", adminController.deleteReview);

// Support Tickets & Disputes
router.get("/support-tickets", adminController.getSupportTickets);
router.put("/support-tickets/:ticketId", adminController.updateSupportTicket);
router.get("/disputes", adminController.getDisputes);

// Categories
router.get("/categories", adminController.getCategories);
router.post("/categories", adminController.createCategory);

// Promotions
router.get("/promotions", adminController.getPromotions);
router.post("/promotions", adminController.createPromotion);
router.put("/promotions/:id/toggle", adminController.togglePromotion);

// Referrals
router.get("/referrals", adminController.getAllReferrals);
router.get("/referrals/stats", adminController.getReferralStats);

// Milestones
router.get("/milestones/case/:caseId", adminController.getMilestonesByCase);

// Notifications & Broadcast
router.get("/notifications", adminController.getNotifications);
router.post("/notifications/broadcast", adminController.broadcastNotification);

// Legal Documents
router.get("/legal", adminController.getLegalDocuments);
router.post("/legal", adminController.createLegalDocument);
router.put("/legal/:id", adminController.updateLegalDocument);

// Audit Logs
router.get("/audit-logs", adminController.getAuditLogs);

// System Settings
router.get("/settings", adminController.getSettings);
router.put("/settings", adminController.updateSettings);

module.exports = router;
