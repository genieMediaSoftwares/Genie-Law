"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Calendar,
  Clock,
  User,
  Filter,
  ChevronRight,
  AlertTriangle,
  Phone,
  Video,
  MapPin,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AppointmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "appointments", search, status, page],
    queryFn: () => adminApi.getAppointments({ page, limit: 20, search, status }),
  });

  const appointments = data?.data || [];
  const totalPages = data?.pages || 1;

  const statusVariant = (s: string) => {
    if (s === "Confirmed" || s === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s === "Pending") return "bg-amber-50 text-amber-700 border-amber-100";
    if (s === "Cancelled" || s === "cancelled") return "bg-red-50 text-red-700 border-red-100";
    return "bg-blue-50 text-blue-700 border-blue-100";
  };

  const modeIcon = (mode?: string) => {
    if (mode?.toLowerCase().includes("video")) return <Video className="w-3.5 h-3.5" />;
    if (mode?.toLowerCase().includes("phone")) return <Phone className="w-3.5 h-3.5" />;
    if (mode?.toLowerCase().includes("visit") || mode?.toLowerCase().includes("office")) return <MapPin className="w-3.5 h-3.5" />;
    return <Calendar className="w-3.5 h-3.5" />;
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Appointments</h1>
        <p className="section-subtitle">Schedule tracking, consultation bookings, and meeting management</p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search client, lawyer, time slot..."
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
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading appointments...</p>
          </div>
        ) : isError ? (
          <div className="empty-state">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-600">Failed to load appointments</p>
            <button onClick={() => window.location.reload()} className="btn btn-secondary mt-3 text-xs">Retry</button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <Calendar className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No appointments found</p>
            <p className="text-xs text-slate-400 mt-1">Bookings will appear here</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Client</th>
                  <th>Lawyer</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Case</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a: any) => (
                  <tr key={a._id}>
                    <td>
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-slate-900">{formatDate(a.date || a.createdAt)}</p>
                        <p className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {a.timeSlot || "N/A"}</p>
                      </div>
                    </td>
                    <td className="text-xs font-medium text-slate-800">{a.client?.fullName || "N/A"}</td>
                    <td className="text-xs font-medium text-slate-800">{a.lawyer?.fullName || "Unassigned"}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md font-medium">
                        {modeIcon(a.mode)} {a.mode || "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className={cn("badge", statusVariant(a.status))}>{a.status || "Pending"}</span>
                    </td>
                    <td className="text-xs text-slate-600">{a.case?.title || "—"}</td>
                    <td className="text-right">
                      <Link href="/appointments" className="action-link">
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
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
