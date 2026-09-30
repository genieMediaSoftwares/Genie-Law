"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  UserCheck,
  Ban,
  RotateCcw,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Star,
  Calendar,
  Clock,
  IndianRupee,
  FileText,
  Filter,
  ChevronRight,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { formatDate, formatCurrency, apiErrorMessage } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ContactVerification } from "@/components/ContactVerification";

export default function LawyersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLawyer, setSelectedLawyer] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "lawyers", search, verificationStatus, page],
    queryFn: () => adminApi.getLawyers({ page, limit: 15, search, verificationStatus }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ lawyerId, data }: { lawyerId: string; data: any }) =>
      adminApi.updateLawyerStatus(lawyerId, data),
    onSuccess: () => {
      toast.success("Lawyer status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyers"] });
    },
    onError: (err: any) => {
      toast.error(apiErrorMessage(err));
    },
  });

  const lawyers = data?.data || [];
  const totalPages = data?.pages || 1;

  const statusVariant = (status?: string) => {
    switch (status) {
      case "verified": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "rejected": return "bg-red-50 text-red-700 border-red-100";
      case "pending": return "bg-amber-50 text-amber-700 border-amber-100";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="page-container">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Advocate Management</h1>
          <p className="section-subtitle">Manage registered advocate profiles, verification badges, and account access</p>
        </div>
        <Link
          href="/lawyer-verification"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm text-sm transition-all"
        >
          <ShieldCheck className="w-4 h-4 text-gold" />
          <span>Verification Hub</span>
        </Link>
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
              placeholder="Search name, specialization, bar number..."
              className="search-input"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={verificationStatus}
              onChange={(e) => { setVerificationStatus(e.target.value); setPage(1); }}
              className="form-select w-full sm:w-auto"
            >
              <option value="all">All Verification Statuses</option>
              <option value="verified">Verified Only</option>
              <option value="pending">Pending Verification</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lawyers Table */}
      <div className="card">
        {isLoading ? (
          <div className="loading-state">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading advocate directory...</p>
          </div>
        ) : isError ? (
          <div className="empty-state">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-600">Failed to load lawyers</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "lawyers"] })} className="btn btn-secondary mt-3 text-xs">
              Retry
            </button>
          </div>
        ) : lawyers.length === 0 ? (
          <div className="empty-state">
            <UserCheck className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No advocates found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search filters</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Advocate</th>
                  <th>Specialization</th>
                  <th>Bar Number</th>
                  <th>Verification</th>
                  <th>Account</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.map((l: any) => {
                  const u = l.user || {};
                  const isActive = u.isActive !== false;
                  return (
                    <tr key={l._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/20 to-amber-500/20 flex items-center justify-center font-bold text-slate-800 text-xs border border-gold/20">
                            {u.fullName ? u.fullName[0].toUpperCase() : "L"}
                          </div>
                          <div>
                            <Link href={`/lawyers/${l._id}`} className="font-semibold text-slate-900 hover:text-gold-hover transition-colors text-sm">
                              {u.fullName || "N/A"}
                            </Link>
                            <p className="text-xs text-slate-500">{u.email}</p>
                            <ContactVerification account={u} />
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-700 font-medium text-sm">{l.specialization || "General Practice"}</td>
                      <td className="font-mono text-xs text-slate-600">{l.barCouncilNumber || "N/A"}</td>
                      <td>
                        <span className={cn("badge", statusVariant(l.verificationStatus))}>
                          {(l.verificationStatus === "verified" && <ShieldCheck className="w-3 h-3" />)}
                          {(l.verificationStatus === "pending" && <Clock className="w-3 h-3" />)}
                          {(l.verificationStatus === "rejected" && <ShieldX className="w-3 h-3" />)}
                          {l.verificationStatus}
                        </span>
                      </td>
                      <td>
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold",
                            isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          )}
                        >
                          {isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/lawyers/${l._id}`} className="action-link">
                            <ExternalLink className="w-3.5 h-3.5" /> View
                          </Link>
                          {isActive ? (
                            <button
                              onClick={() => updateStatusMutation.mutate({ lawyerId: l._id, data: { isActive: false } })}
                              className="action-btn bg-red-50 text-red-700 hover:bg-red-100"
                              title="Suspend"
                            >
                              <Ban className="w-3.5 h-3.5" /> Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => updateStatusMutation.mutate({ lawyerId: l._id, data: { isActive: true } })}
                              className="action-btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Reactivate"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="pagination-btn">
                Previous
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="pagination-btn">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}