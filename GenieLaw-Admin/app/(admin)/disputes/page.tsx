"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Filter,
  AlertTriangle,
  AlertTriangle as AlertTriangleIcon,
  ChevronRight,
  Clock,
  User,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function DisputesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "disputes", search, status, page],
    queryFn: () => adminApi.getDisputes({ page, limit: 15, search, status }),
  });

  const disputes = data?.data || [];
  const totalPages = data?.pages || 1;

  const statusVariant = (s: string) => {
    if (s === "Resolved") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s === "Pending") return "bg-red-50 text-red-700 border-red-100";
    if (s === "Assigned") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Dispute Management</h1>
        <p className="section-subtitle">Review and resolve payment disputes and support issues</p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search dispute ID, client, lawyer..."
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
              <option value="all">All Disputes</option>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading disputes...</p></div>
        ) : isError ? (
          <div className="empty-state"><AlertTriangleIcon className="w-10 h-10 text-red-400 mb-2" /><p className="text-sm font-semibold text-red-600">Failed to load disputes</p></div>
        ) : disputes.length === 0 ? (
          <div className="empty-state"><AlertTriangleIcon className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No disputes recorded</p></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dispute ID</th>
                  <th>Issue</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Filed</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d: any) => (
                  <tr key={d._id}>
                    <td className="font-mono text-xs font-bold text-slate-800">{d._id?.slice(-8) || "—"}</td>
                    <td>
                      <p className="text-xs font-medium text-slate-900">{d.title || "Dispute"}</p>
                      {d.description && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{d.description}</p>}
                    </td>
                    <td className="text-xs font-medium text-slate-800">{d.clientId?.fullName || "N/A"}</td>
                    <td><span className={cn("badge", statusVariant(d.status))}>{d.status}</span></td>
                    <td className="text-xs text-slate-500">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
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