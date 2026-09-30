"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  ShieldCheck,
  ShieldX,
  Clock,
  Eye,
  UserCheck,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mail,
  Phone,
  GraduationCap,
  MapPin,
  ChevronRight,
  Filter,
  Users,
} from "lucide-react";
import { formatDate, formatDateTime, apiErrorMessage } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LawyerVerificationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "lawyer-verification", status, search, page],
    queryFn: () => adminApi.getLawyers({ page, limit: 15, search, verificationStatus: status }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ lawyerId, verificationStatus, notes }: { lawyerId: string; verificationStatus: string; notes?: string }) =>
      adminApi.updateLawyerVerification(lawyerId, { verificationStatus, notes }),
    onSuccess: () => {
      toast.success("Lawyer verification status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyer-verification"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const lawyers = data?.data || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Lawyer Verification Hub</h1>
          <p className="section-subtitle">Review and approve advocate registrations and professional credentials</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/lawyers" className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm text-sm transition-all">
            <Users className="w-4 h-4" /> View All Lawyers
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{isLoading ? "..." : data?.pendingCount || lawyers.filter((l: any) => l.verificationStatus === "pending").length}</p>
              <p className="text-xs text-slate-500 font-medium">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{isLoading ? "..." : data?.verifiedCount || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Verified</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{isLoading ? "..." : data?.rejectedCount || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Rejected</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{isLoading ? "..." : data?.totalLawyers || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Total Registered</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, bar number, specialization..."
              className="search-input"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="form-select w-full sm:w-auto"
            >
              <option value="pending">Pending Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lawyers Table */}
      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading verification queue...</p></div>
        ) : isError ? (
          <div className="empty-state"><AlertTriangle className="w-10 h-10 text-red-400 mb-2" /><p className="text-sm font-semibold text-red-600">Failed to load verification queue</p></div>
        ) : lawyers.length === 0 ? (
          <div className="empty-state"><CheckCircle className="w-10 h-10 text-emerald-400 mb-2" /><p className="text-sm font-semibold text-slate-700">No lawyers in this queue</p><p className="text-xs text-slate-400">All caught up!</p></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Advocate</th>
                  <th>Bar Number</th>
                  <th>Specialization</th>
                  <th>Verification</th>
                  <th>Experience</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.map((l: any) => {
                  const u = l.user || {};
                  return (
                    <tr key={l._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-amber-500/20 flex items-center justify-center font-bold text-slate-800 text-sm border border-gold/20">
                            {u.fullName ? u.fullName[0].toUpperCase() : "L"}
                          </div>
                          <div>
                            <Link href={`/lawyers/${l._id}`} className="font-semibold text-slate-900 hover:text-gold-hover transition-colors text-sm">{u.fullName || "N/A"}</Link>
                            <p className="text-xs text-slate-500">{u.email}</p>
                            {l.barCouncilNumber && <p className="text-[10px] font-mono text-slate-400 mt-0.5">Bar: {l.barCouncilNumber}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs font-bold text-slate-800">{l.barCouncilNumber || "N/A"}</td>
                      <td className="text-xs text-slate-700 font-medium">{l.specialization || "N/A"}</td>
                      <td>
                        <span className={cn("badge",
                          l.verificationStatus === "verified" ? "badge-success" :
                          l.verificationStatus === "rejected" ? "badge-danger" :
                          "badge-warning"
                        )}>
                          {l.verificationStatus === "verified" && <CheckCircle className="w-3.5 h-3.5" />}
                          {l.verificationStatus === "rejected" && <XCircle className="w-3.5 h-3.5" />}
                          {l.verificationStatus === "pending" && <Clock className="w-3.5 h-3.5" />}
                          {l.verificationStatus}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600 font-medium">{l.experience ? `${l.experience} years` : "N/A"}</td>
                      <td className="text-right">
                        {l.verificationStatus === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => updateStatusMutation.mutate({ lawyerId: l._id, verificationStatus: "verified" })}
                              className="action-btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Verify"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Verify
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason) updateStatusMutation.mutate({ lawyerId: l._id, verificationStatus: "rejected", notes: reason });
                              }}
                              className="action-btn bg-red-50 text-red-700 hover:bg-red-100"
                              title="Reject"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="pagination-btn">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="pagination-btn">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}