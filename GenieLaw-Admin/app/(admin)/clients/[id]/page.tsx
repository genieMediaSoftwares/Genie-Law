"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  UserCircle,
  IndianRupee,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["admin", "client", clientId],
    queryFn: () => adminApi.getClientById(clientId),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 ml-3">Loading client profile...</p>
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh]">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-sm font-semibold text-red-600">Client not found</p>
        <Link href="/clients" className="btn btn-primary mt-4 text-xs">Return to Directory</Link>
      </div>
    );
  }

  const isActive = client.isActive !== false;

  return (
    <div className="page-container">
      <Link href="/clients" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Client Directory
      </Link>

      <div className="card">
        <div className="card-body">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center font-extrabold text-2xl text-slate-700 border-2 border-emerald-200 shrink-0">
              {client.fullName?.[0]?.toUpperCase() || "C"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900">{client.fullName}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{client.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn("badge", isActive ? "badge-success" : "badge-danger")}>
                  {isActive ? "Active" : "Suspended"}
                </span>
                <span className="text-xs text-slate-500">Joined {formatDate(client.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Total Cases</p><p className="text-lg font-extrabold text-slate-900">{client.casesCount || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Consultations</p><p className="text-lg font-extrabold text-slate-900">{client.consultationsCount || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Total Spent</p><p className="text-lg font-extrabold text-slate-900">{formatCurrency(client.totalSpent || 0)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Account Age</p><p className="text-lg font-extrabold text-slate-900">{Math.floor((Date.now() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days</p></div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="text-base font-bold text-slate-900">Contact Information</h2></div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Info label="Email" value={client.email} icon={Mail} />
          <Info label="Phone" value={client.mobile || "N/A"} icon={Phone} />
          <Info label="Location" value={client.location || "N/A"} icon={MapPin} />
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