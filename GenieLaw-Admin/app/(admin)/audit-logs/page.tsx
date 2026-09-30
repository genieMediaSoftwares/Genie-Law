"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Shield,
  Search,
  AlertTriangle,
  UserCheck,
  Ban,
  FileText,
  Settings,
  DollarSign,
  Clock,
  ShieldX,
  User,
  Eye,
  Filter,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Actions recorded by the backend (logAuditAction in adminController).
const ACTION_ICONS: Record<string, any> = {
  verify_lawyer: UserCheck,
  update_lawyer_status: Ban,
  update_client_status: User,
  process_refund: DollarSign,
  update_subscription: DollarSign,
  update_admin_settings: Settings,
  update_review: Eye,
  create_category: FileText,
  create_promotion: FileText,
  toggle_promotion: FileText,
  create_legal_document: ShieldX,
  update_legal_document: ShieldX,
};

const actionLabel = (action?: string) =>
  (action || "action").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "audit-logs", search, action, page],
    queryFn: () => adminApi.getAuditLogs({ page, limit: 20, search, action }),
  });

  const logs = data?.data || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Audit Logs</h1>
        <p className="section-subtitle">Immutable record of sensitive administrative actions</p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search admin, action, target..."
              className="search-input"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="form-select w-full sm:w-auto">
              <option value="all">All Actions</option>
              {Object.keys(ACTION_ICONS).map((key) => (
                <option key={key} value={key}>{actionLabel(key)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading audit logs...</p></div>
        ) : isError ? (
          <div className="empty-state"><AlertTriangle className="w-10 h-10 text-red-400 mb-2" /><p className="text-sm font-semibold text-red-600">Failed to load audit logs</p></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><Shield className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No audit log entries</p></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => {
                  const Icon = ACTION_ICONS[log.action] || Shield;
                  return (
                    <tr key={log._id}>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center font-bold text-slate-800 text-[10px]">
                            {log.performedBy?.fullName?.[0]?.toUpperCase() || "A"}
                          </div>
                          <span className="text-xs font-semibold text-slate-900">{log.performedBy?.fullName || log.performedBy?.email || "System"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Icon className="w-3 h-3 text-slate-500" /> {actionLabel(log.action)}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600 font-mono">{log.targetModel ? `${log.targetModel} · ${log.targetId}` : log.targetId || "N/A"}</td>
                      <td className="text-xs text-slate-600 max-w-xs truncate" title={JSON.stringify(log.details || {})}>
                        {Object.entries(log.details || {})
                          .filter(([, value]) => value !== undefined && value !== null && value !== "")
                          .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
                          .join(" · ") || "—"}
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