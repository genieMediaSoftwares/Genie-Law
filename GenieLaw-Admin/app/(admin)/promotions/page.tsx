"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Tag,
  Plus,
  Search,
  Calendar,
  IndianRupee,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { formatDate, formatCurrency, apiErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { name: "", code: "", discount: "", validUntil: "", usageLimit: "" };
  const [formData, setFormData] = useState(emptyForm);

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: adminApi.getPromotions,
  });

  const createMutation = useMutation({
    mutationFn: adminApi.createPromotion,
    onSuccess: () => {
      toast.success("Promotion code created");
      setShowForm(false);
      setFormData(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.togglePromotion(id),
    onSuccess: () => {
      toast.success("Promotion status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name.trim() || formData.code.trim().toUpperCase(),
      code: formData.code.trim(),
      discountType: "percentage",
      discountValue: Number(formData.discount),
      startDate: new Date().toISOString(),
      endDate: new Date(`${formData.validUntil}T23:59:59`).toISOString(),
      maxUses: Number(formData.usageLimit),
    });
  };

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Promotions & Offers</h1>
          <p className="section-subtitle">Create discount codes and promotional offers for clients</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-xs px-4 py-2.5">
          <Plus className="w-4 h-4" /> New Promotion
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-bold text-slate-900">Create New Promotion</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure code, discount, and validity period</p>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="label-field">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Summer offer" className="form-input" />
              </div>
              <div>
                <label className="label-field">Code</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g., SUMMER50" required className="form-input uppercase" />
              </div>
              <div>
                <label className="label-field">Discount (%)</label>
                <input type="number" min="1" max="100" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} placeholder="e.g., 20" required className="form-input" />
              </div>
              <div>
                <label className="label-field">Valid Until</label>
                <input type="date" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} required className="form-input" />
              </div>
              <div>
                <label className="label-field">Usage Limit</label>
                <input type="number" min="1" value={formData.usageLimit} onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })} placeholder="e.g., 100" required className="form-input" />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary text-xs">{createMutation.isPending ? "Creating..." : "Create Promotion"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading promotions...</p></div>
        ) : promos.length === 0 ? (
          <div className="empty-state"><Tag className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No promotions yet</p><p className="text-xs text-slate-400">Create your first discount code</p></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Valid Until</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p: any) => (
                  <tr key={p._id}>
                    <td>
                      <p className="font-mono font-bold text-slate-900 text-sm">{p.code}</p>
                      <p className="text-xs text-slate-500">{p.name}</p>
                    </td>
                    <td className="font-bold text-emerald-700 text-sm">
                      {p.discountType === "fixed" ? `₹${p.discountValue}` : `${p.discountValue}%`}
                    </td>
                    <td className="text-xs text-slate-600">{formatDate(p.endDate)}</td>
                    <td className="text-xs text-slate-700">{p.usedCount || 0} / {p.maxUses ? p.maxUses : "∞"}</td>
                    <td>
                      <span className={cn("badge", p.isActive ? "badge-success" : "badge-warning")}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => toggleMutation.mutate(p._id)} disabled={toggleMutation.isPending} className="action-link">
                        {p.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}