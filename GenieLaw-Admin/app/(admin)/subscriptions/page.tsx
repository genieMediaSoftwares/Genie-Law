"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Crown,
  Calendar,
  CreditCard,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "subscriptions", search, status, page],
    queryFn: () => adminApi.getSubscriptions({ page, limit: 15, search, status }),
  });

  const subscriptions = data?.data || [];
  const totalPages = data?.pages || 1;

  const statusVariant = (s: string) => {
    if (s === "active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s === "expired") return "bg-slate-100 text-slate-600 border-slate-200";
    if (s === "cancelled") return "bg-red-50 text-red-700 border-red-100";
    return "bg-amber-50 text-amber-700 border-amber-100";
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Subscription Management</h1>
        <p className="section-subtitle">Monitor advocate subscription plans and billing statuses</p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search lawyer, plan type..."
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
              <option value="all">All Subscriptions</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading subscriptions...</p></div>
        ) : isError ? (
          <div className="empty-state"><AlertTriangle className="w-10 h-10 text-red-400 mb-2" /><p className="text-sm font-semibold text-red-600">Failed to load subscriptions</p></div>
        ) : subscriptions.length === 0 ? (
          <div className="empty-state"><Crown className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No subscriptions found</p></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s: any) => (
                  <tr key={s._id}>
                    <td>
                      <p className="font-semibold text-slate-900 text-sm">{s.user?.fullName || "N/A"}</p>
                      <p className="text-xs text-slate-500">{s.user?.email}</p>
                    </td>
                    <td className="text-xs text-slate-700 font-medium">{s.plan}</td>
                    <td>
                      <span className={cn("badge", statusVariant(s.status))}>{s.status || "active"}</span>
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(s.startDate)}</td>
                    <td className="text-xs text-slate-500">{formatDate(s.endDate)}</td>
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