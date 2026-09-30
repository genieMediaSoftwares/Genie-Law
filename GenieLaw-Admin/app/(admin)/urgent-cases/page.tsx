"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Flame,
  Briefcase,
  Eye,
  AlertTriangle,
  Phone,
  Mail,
  User,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function UrgentCasesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "urgent-cases"],
    // The backend selects cases whose urgency is urgent / immediate / high.
    queryFn: adminApi.getUrgentCases,
  });

  const cases = data?.data || [];

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Flame className="w-6 h-6 text-red-600 fill-red-600" /> Urgent Cases
        </h1>
        <p className="section-subtitle">High-priority cases requiring immediate attention and triage</p>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading urgent cases...</p></div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <Flame className="w-10 h-10 text-amber-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No urgent cases right now</p>
            <p className="text-xs text-slate-400 mt-1">High-priority cases will surface here automatically</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Client</th>
                  <th>Category</th>
                  <th>Filed</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c: any) => (
                  <tr key={c._id} className="bg-red-50/30">
                    <td>
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-red-500 fill-red-500 shrink-0" />
                        <Link href={`/cases/${c._id}`} className="font-semibold text-slate-900 hover:text-red-600 transition-colors text-sm">{c.title}</Link>
                      </div>
                    </td>
                    <td className="text-xs font-medium text-slate-800">{c.client?.fullName || "N/A"}</td>
                    <td className="text-xs text-slate-600">{c.category}</td>
                    <td className="text-xs text-slate-500">{formatDate(c.createdAt)}</td>
                    <td><span className="badge badge-danger">{c.status}</span></td>
                    <td className="text-right">
                      <Link href={`/cases/${c._id}`} className="action-link"><Eye className="w-3.5 h-3.5" /> Triage</Link>
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