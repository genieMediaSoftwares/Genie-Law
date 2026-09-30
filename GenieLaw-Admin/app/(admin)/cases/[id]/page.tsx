"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  ArrowLeft,
  FileText,
  Clock,
  Briefcase,
  ShieldCheck,
  Calendar,
  Flame,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [activeTab, setActiveTab] = useState("details");

  const { data: caseItem, isLoading, isError } = useQuery({
    queryKey: ["admin", "case", caseId],
    queryFn: () => adminApi.getCaseById(caseId),
    enabled: !!caseId,
  });

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 ml-3">Loading case details...</p>
      </div>
    );
  }

  if (isError || !caseItem) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh]">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-sm font-semibold text-red-600">Case not found</p>
        <Link href="/cases" className="btn btn-primary mt-4 text-xs">Return to Cases</Link>
      </div>
    );
  }

  const client = caseItem.client || {};
  const lawyer = caseItem.assignedLawyer?.user || caseItem.assignedLawyer || {};
  const isUrgent = caseItem.urgency?.toLowerCase().includes("urgent");

  return (
    <div className="page-container">
      <Link href="/cases" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
      </Link>

      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isUrgent && <Flame className="w-5 h-5 text-red-600 fill-red-600" />}
                <h1 className="text-xl font-extrabold text-slate-900">{caseItem.title}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="badge bg-slate-100 text-slate-700 border-slate-200">{caseItem.category}</span>
                <span className={cn("badge", caseItem.status === "Closed" ? "badge-success" : caseItem.status === "In Progress" ? "bg-blue-50 text-blue-700 border-blue-100" : "badge-warning")}>
                  {caseItem.status}
                </span>
                {isUrgent && <span className="badge badge-danger">Urgent</span>}
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">ID: {caseItem._id?.slice(-8)}</span>
          </div>
        </div>
      </div>

      {/* Case info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="text-base font-bold text-slate-900">Case Information</h2></div>
          <div className="card-body space-y-4">
            <Info label="Location" value={caseItem.location || "N/A"} icon={MapPin} />
            <Info label="Court" value={caseItem.preferredCourt || "N/A"} icon={Briefcase} />
            <Info label="Urgency" value={caseItem.urgency || "—"} icon={Flame} />
            <Info label="Category" value={caseItem.category} icon={FileText} />
            {caseItem.description && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{caseItem.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="text-base font-bold text-slate-900">Parties Involved</h2></div>
          <div className="card-body space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Client</p>
              <p className="text-sm font-semibold text-slate-900">{client.fullName || "N/A"}</p>
              <p className="text-xs text-slate-500">{client.email || "N/A"}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Assigned Advocate</p>
              <p className="text-sm font-semibold text-slate-900">{lawyer.fullName || "Unassigned"}</p>
              {lawyer.email && <p className="text-xs text-slate-500">{lawyer.email}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-header"><h2 className="text-base font-bold text-slate-900">Timeline</h2></div>
        <div className="card-body space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gold shrink-0" />
            <p className="text-xs text-slate-500">Case created on {formatDateTime(caseItem.createdAt)}</p>
          </div>
          {caseItem.updatedAt && (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              <p className="text-xs text-slate-500">Last updated {formatDateTime(caseItem.updatedAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
      {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}