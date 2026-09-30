"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Filter,
  Eye,
  Ban,
  RotateCcw,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  FileText,
  Calendar,
  ChevronRight,
  AlertTriangle,
  UserCircle,
} from "lucide-react";
import { formatDate, apiErrorMessage } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ContactVerification } from "@/components/ContactVerification";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "clients", search, status, page],
    queryFn: () => adminApi.getClients({ page, limit: 15, search, status }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ clientId, isActive }: { clientId: string; isActive: boolean }) =>
      adminApi.updateClientStatus(clientId, isActive),
    onSuccess: () => {
      toast.success("Client status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
    onError: (err: any) => {
      toast.error(apiErrorMessage(err));
    },
  });

  const clients = data?.data || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Client Management</h1>
        <p className="section-subtitle">View and manage registered client accounts and account statuses</p>
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
              placeholder="Search name, email, phone..."
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
              <option value="all">All Accounts</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive / Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="card">
        {isLoading ? (
          <div className="loading-state">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading client records...</p>
          </div>
        ) : isError ? (
          <div className="empty-state">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-600">Failed to load clients</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "clients"] })} className="btn btn-secondary mt-3 text-xs">Retry</button>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <UserCircle className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No client records found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting search filters</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Cases</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => (
                  <tr key={c._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center font-bold text-slate-700 text-xs border border-emerald-200">
                          {c.fullName ? c.fullName[0].toUpperCase() : "C"}
                        </div>
                        <Link href={`/clients/${c._id}`} className="font-semibold text-slate-900 hover:text-gold-hover transition-colors text-sm">
                          {c.fullName || "N/A"}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className="text-xs space-y-0.5">
                        <p className="text-slate-900 font-medium flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {c.email}</p>
                        <p className="text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {c.mobile || "N/A"}</p>
                        <ContactVerification account={c} />
                      </div>
                    </td>
                    <td className="text-slate-700 text-xs font-medium">{c.location || "N/A"}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                        <Briefcase className="w-3 h-3 text-slate-400" /> {c.casesCount || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold",
                          c.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        )}
                      >
                        {c.isActive !== false ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/clients/${c._id}`} className="action-link">
                          <Eye className="w-3.5 h-3.5" /> Profile
                        </Link>
                        {c.isActive !== false ? (
                          <button onClick={() => updateStatusMutation.mutate({ clientId: c._id, isActive: false })} className="action-btn bg-red-50 text-red-700 hover:bg-red-100" title="Suspend">
                            <Ban className="w-3.5 h-3.5" /> Suspend
                          </button>
                        ) : (
                          <button onClick={() => updateStatusMutation.mutate({ clientId: c._id, isActive: true })} className="action-btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Reactivate">
                            <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                          </button>
                        )}
                      </div>
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