"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import { CASE_STATUSES } from "@/lib/caseStatus";
import {
  Search,
  Filter,
  Eye,
  Briefcase,
  Flame,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  User,
  Clock,
  MapPin,
} from "lucide-react";
import { formatDate, apiErrorMessage } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CasesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "cases", search, status, page],
    queryFn: () => adminApi.getCases({ page, limit: 15, search, status }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ caseId, status }: { caseId: string; status: string }) =>
      adminApi.updateCaseStatus(caseId, { status }),
    onSuccess: () => {
      toast.success("Case status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
    },
    onError: (err: any) => {
      toast.error(apiErrorMessage(err));
    },
  });

  const cases = data?.data || [];
  const totalPages = data?.pages || 1;

  const statusVariant = (s: string) => {
    if (["Completed", "completed", "Closed", "closed"].includes(s)) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (["In Progress", "in_progress", "Pending", "pending"].includes(s)) return "bg-blue-50 text-blue-700 border-blue-100";
    return "bg-amber-50 text-amber-700 border-amber-100";
  };

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Case Administration</h1>
          <p className="section-subtitle">Monitor all legal cases submitted on the platform</p>
        </div>
        <Link
          href="/urgent-cases"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm text-sm transition-all"
        >
          <Flame className="w-4 h-4 fill-white" /> Urgent Cases
        </Link>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search title, category, client name..."
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
              <option value="all">All Case Statuses</option>
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading cases directory...</p>
          </div>
        ) : isError ? (
          <div className="empty-state">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-600">Failed to load cases</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "cases"] })} className="btn btn-secondary mt-3 text-xs">Retry</button>
          </div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <Briefcase className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No cases found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search criteria</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case Title & Category</th>
                  <th>Client</th>
                  <th>Assigned Lawyer</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c: any) => {
                  const client = c.client || {};
                  const lawyer = c.assignedLawyer?.user || c.assignedLawyer || {};
                  const isUrgent = /urgent|immediate|high/i.test(c.urgency || "");
                  return (
                    <tr key={c._id} className={isUrgent ? "bg-red-50/30" : ""}>
                      <td>
                        <div>
                          <Link href={`/cases/${c._id}`} className="font-semibold text-slate-900 hover:text-gold-hover transition-colors text-sm flex items-center gap-1.5">
                            {c.title}
                            {isUrgent && <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 shrink-0" />}
                          </Link>
                          <p className="text-xs text-slate-500 mt-0.5">{c.category} • {c.location || "N/A"}</p>
                        </div>
                      </td>
                      <td className="text-xs font-medium text-slate-800">{client.fullName || "N/A"}</td>
                      <td className="text-xs font-medium text-slate-800">{lawyer.fullName || "Unassigned"}</td>
                      <td>
                        {isUrgent ? (
                          <span className="badge badge-danger">Urgent</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-600 border-slate-200">{c.urgency || "—"}</span>
                        )}
                      </td>
                      <td>
                        <select
                          value={c.status}
                          onChange={(e) => updateStatusMutation.mutate({ caseId: c._id, status: e.target.value })}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-gold/40", statusVariant(c.status))}
                        >
                          {CASE_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-right">
                        <Link href={`/cases/${c._id}`} className="action-link">
                          <Eye className="w-3.5 h-3.5" /> Details
                        </Link>
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