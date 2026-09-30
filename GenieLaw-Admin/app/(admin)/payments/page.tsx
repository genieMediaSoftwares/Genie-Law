"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  CreditCard,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Receipt,
  Filter,
} from "lucide-react";
import { formatDate, formatCurrency, apiErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "payments", search, status, page],
    queryFn: () => adminApi.getPayments({ page, limit: 20, search, status }),
  });

  const configQuery = useQuery({
    queryKey: ["admin", "payments", "config"],
    queryFn: () => adminApi.getPaymentConfig(),
  });
  const config = configQuery.data?.data;
  const paymentsEnabled = Boolean(config?.paymentsEnabled);

  const refundMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      adminApi.processRefund(paymentId, reason),
    onSuccess: () => {
      toast.success("Refund processed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (err: any) => {
      toast.error(apiErrorMessage(err));
    },
  });

  const payments = data?.data || [];
  const totalPages = data?.pages || 1;

  const statusVariant = (s: string) => {
    if (s === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s === "refunded") return "bg-purple-50 text-purple-700 border-purple-100";
    if (s === "failed") return "bg-red-50 text-red-700 border-red-100";
    return "bg-amber-50 text-amber-700 border-amber-100";
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Payments & Transactions</h1>
        <p className="section-subtitle">Monitor consultation fees, payment transactions, and process refunds</p>
      </div>

      {/* Payment configuration: comes from the backend (PAYMENTS_ENABLED / PAYMENT_GATEWAY). */}
      <div className="card">
        <div className="card-body">
          {configQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading payment configuration…</p>
          ) : configQuery.isError || !config ? (
            <p className="text-sm text-red-600">Payment configuration could not be loaded.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("badge", paymentsEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100")}>
                  {paymentsEnabled ? "PAYMENTS LIVE" : "PAYMENTS DISABLED / FREE PERIOD"}
                </span>
                <span className="text-sm text-slate-600">
                  Gateway: <strong>{config.gateway}</strong> ({config.gatewayLive ? "live" : "not connected"})
                </span>
              </div>
              <p className="text-sm text-slate-600">{config.message}</p>
              <div>
                <h2 className="text-sm font-semibold text-slate-800 mb-2">Plans</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(config.plans || []).map((plan: any) => (
                    <div key={plan.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{plan.name}</span>
                        <span className="text-[10px] font-semibold text-amber-700">{plan.state.replace("_", " ")}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {formatCurrency(plan.amountMinor / 100)} / {plan.interval}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search payment ID, client, lawyer..."
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
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state">
            <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 font-medium">Loading payment records...</p>
          </div>
        ) : isError ? (
          <div className="empty-state">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-600">Failed to load payments</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "payments"] })} className="btn btn-secondary mt-3 text-xs">Retry</button>
          </div>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <Receipt className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No payment transactions recorded</p>
            <p className="text-xs text-slate-400 mt-1">Completed payments will appear here</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Client</th>
                  <th>Lawyer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p._id}>
                    <td>
                      <div>
                        <p className="font-mono text-xs font-bold text-slate-800">{p.razorpayPaymentId || p._id}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.purpose || "Consultation"}</p>
                      </div>
                    </td>
                    <td className="text-xs font-medium text-slate-800">{p.client?.fullName || "N/A"}</td>
                    <td className="text-xs font-medium text-slate-800">{p.lawyer?.fullName || "N/A"}</td>
                    <td>
                      <span className="font-bold text-slate-900 text-sm">{formatCurrency(p.amount, p.currency)}</span>
                    </td>
                    <td>
                      <span className={cn("badge", statusVariant(p.status))}>{p.status}</span>
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(p.createdAt)}</td>
                    <td className="text-right">
                      {p.status === "completed" && paymentsEnabled ? (
                        <button
                          onClick={() => {
                            const reason = prompt("Enter reason for refund:");
                            if (reason) refundMutation.mutate({ paymentId: p._id, reason });
                          }}
                          className="action-btn bg-purple-50 text-purple-700 hover:bg-purple-100"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Refund
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No action</span>
                      )}
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