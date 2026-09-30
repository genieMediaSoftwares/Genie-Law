import { api, API_ORIGIN } from "./axios";

export const adminApi = {
  // Stats & Analytics
  getDashboardStats: () => api.get("/admin/stats").then((res) => res.data.data),
  getAnalyticsData: () => api.get("/admin/analytics").then((res) => res.data.data),

  // Clients
  getClients: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/clients", { params }).then((res) => res.data),
  getClientById: (id: string) => api.get(`/admin/clients/${id}`).then((res) => res.data.data),
  updateClientStatus: (id: string, isActive: boolean) =>
    api.put(`/admin/clients/${id}/status`, { isActive }).then((res) => res.data),

  // Lawyers & Verification
  getLawyers: (params?: { page?: number; limit?: number; search?: string; verificationStatus?: string }) =>
    api.get("/admin/lawyers", { params }).then((res) => res.data),
  getLawyerById: (id: string) => api.get(`/admin/lawyers/${id}`).then((res) => res.data.data),
  updateLawyerStatus: (id: string, data: { isActive?: boolean; verificationStatus?: string }) =>
    api.put(`/admin/lawyers/${id}/status`, data).then((res) => res.data),
  updateLawyerVerification: (id: string, data: { verificationStatus: string; notes?: string }) =>
    api.put(`/admin/lawyers/${id}/verify`, { status: data.verificationStatus, rejectionReason: data.notes }).then((res) => res.data),

  // Cases
  getCases: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/cases", { params }).then((res) => res.data),
  getUrgentCases: () => api.get("/admin/cases/urgent").then((res) => res.data),
  getCaseById: (id: string) => api.get(`/admin/cases/${id}`).then((res) => res.data.data),
  updateCaseStatus: (id: string, data: { status?: string; priority?: string }) =>
    api.put(`/admin/cases/${id}/status`, data).then((res) => res.data),

  // Appointments & Consultations
  getAppointments: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/appointments", { params }).then((res) => res.data),

  // Documents
  getDocuments: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    api.get("/admin/documents", { params }).then((res) => res.data),
  // Opens a stored file (Document.filePath, "uploads/...") with the admin's
  // session; files are never public.
  openFile: async (filePath: string) => {
    const path = "/" + String(filePath || "").replace(/^\/+/, "");
    const res = await api.get(path, { baseURL: API_ORIGIN, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  // Payments & Refunds
  // Mode (free period / live), gateway and plan catalog. Read-only: set in backend .env.
  getPaymentConfig: () => api.get("/admin/payments/config").then((res) => res.data),
  getPayments: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/payments", { params }).then((res) => res.data),
  processRefund: (paymentId: string, reason: string) =>
    api.post(`/admin/payments/${paymentId}/refund`, { reason }).then((res) => res.data),

  // Subscriptions
  getSubscriptions: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/subscriptions", { params }).then((res) => res.data),

  // Reviews & Moderation
  getReviews: (params?: { page?: number; limit?: number; search?: string; status?: string; isReported?: string }) =>
    api.get("/admin/reviews", { params }).then((res) => res.data),
  updateReviewVisibility: (id: string, data: { isHidden?: boolean; isReported?: boolean }) =>
    api.put(`/admin/reviews/${id}/visibility`, data).then((res) => res.data),
  // Permanently removes a review; the backend audits it and recalculates the rating.
  deleteReview: (id: string, reason: string) =>
    api.delete(`/admin/reviews/${id}`, { data: { reason } }).then((res) => res.data),

  // Disputes
  getDisputes: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get("/admin/disputes", { params }).then((res) => res.data),

  // Categories & Promotions
  getCategories: () => api.get("/admin/categories").then((res) => res.data.data),
  createCategory: (data: { name: string; description?: string }) =>
    api.post("/admin/categories", data).then((res) => res.data),
  getPromotions: () => api.get("/admin/promotions").then((res) => res.data.data),
  createPromotion: (data: {
    name: string;
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    startDate: string;
    endDate: string;
    maxUses?: number;
  }) => api.post("/admin/promotions", data).then((res) => res.data),
  togglePromotion: (id: string) =>
    api.put(`/admin/promotions/${id}/toggle`).then((res) => res.data),

  // Notifications & Broadcast
  getNotifications: (params?: { page?: number; limit?: number }) =>
    api.get("/admin/notifications", { params }).then((res) => res.data.data),
  broadcastNotification: (data: { title: string; message: string; targetRole?: string }) =>
    api.post("/admin/notifications/broadcast", data).then((res) => res.data),

  // Legal Documents
  getLegalDocuments: () => api.get("/admin/legal").then((res) => res.data.data),
  // Publishing creates a new active version; earlier versions (and the
  // acceptances recorded against them) are kept.
  createLegalDocument: (data: {
    type: string;
    version: string;
    title: string;
    content: string;
    audience?: string;
    isActive?: boolean;
    requiresAcceptance?: boolean;
  }) => api.post("/admin/legal", data).then((res) => res.data),

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; search?: string }) =>
    api.get("/admin/audit-logs", { params }).then((res) => res.data),

  // Settings
  getSettings: () => api.get("/admin/settings").then((res) => res.data.data),
  updateSettings: (data: any) => api.put("/admin/settings", data).then((res) => res.data),
};
