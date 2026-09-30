"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Star,
  Briefcase,
  DollarSign,
  Calendar,
  ShieldCheck,
  ShieldX,
  Clock,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { formatDate, formatCurrency, apiErrorMessage } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LawyerDetailPage() {
  const params = useParams();
  const lawyerId = params.id as string;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");

  const { data: lawyer, isLoading, isError } = useQuery({
    queryKey: ["admin", "lawyer", lawyerId],
    queryFn: () => adminApi.getLawyerById(lawyerId),
    enabled: !!lawyerId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateLawyerStatus(lawyerId, data),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyer", lawyerId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyers"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      adminApi.updateLawyerVerification(lawyerId, { verificationStatus: status, notes }),
    onSuccess: () => {
      toast.success("Verification updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyer", lawyerId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "lawyer-verification"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 ml-3">Loading advocate profile...</p>
      </div>
    );
  }

  if (isError || !lawyer) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-[60vh]">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-sm font-semibold text-red-600">Advocate not found</p>
        <Link href="/lawyers" className="btn btn-primary mt-4 text-xs">Return to Directory</Link>
      </div>
    );
  }

  const u = lawyer.user || {};
  const isVerified = lawyer.verificationStatus === "verified";
  const isActive = u.isActive !== false;

  const tabs = [
    { id: "overview", label: "Overview", icon: Briefcase },
    { id: "cases", label: "Cases", icon: Briefcase },
    { id: "payments", label: "Payments", icon: DollarSign },
    { id: "activity", label: "Activity", icon: Calendar },
  ];

  return (
    <div className="page-container">
      {/* Back */}
      <Link href="/lawyers" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Advocate Directory
      </Link>

      {/* Profile Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/30 to-amber-500/30 flex items-center justify-center font-extrabold text-2xl text-slate-800 border-2 border-gold/30 shrink-0">
              {u.fullName?.[0]?.toUpperCase() || "L"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900">{u.fullName}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{u.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn("badge", isVerified ? "badge-success" : "badge-warning")}>
                  {isVerified ? <ShieldCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {lawyer.verificationStatus}
                </span>
                <span className={cn("badge", isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100")}>
                  {isActive ? "Active" : "Suspended"}
                </span>
                <span className="badge bg-blue-50 text-blue-700 border-blue-100">{lawyer.specialization}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isVerified && (
                <button onClick={() => verifyMutation.mutate({ status: "verified" })} className="btn btn-success text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" /> Approve
                </button>
              )}
              {isActive ? (
                <button onClick={() => updateStatusMutation.mutate({ isActive: false })} className="btn btn-danger text-xs">
                  Suspend
                </button>
              ) : (
                <button onClick={() => updateStatusMutation.mutate({ isActive: true })} className="btn btn-success text-xs">
                  Reactivate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Experience</p><p className="text-lg font-extrabold text-slate-900">{lawyer.experience || 0} years</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Consultations</p><p className="text-lg font-extrabold text-slate-900">{lawyer.consultationsCount || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Cases Handled</p><p className="text-lg font-extrabold text-slate-900">{lawyer.casesCount || 0}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500 font-medium mb-1">Revenue</p><p className="text-lg font-extrabold text-slate-900">{formatCurrency(lawyer.totalEarnings || 0)}</p></div>
      </div>

      {/* Details Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-bold text-slate-900">Professional Details</h2>
        </div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Info label="Bar Council Number" value={lawyer.barCouncilNumber || "N/A"} icon={GraduationCap} />
          <Info label="Phone" value={u.mobile || "N/A"} icon={Phone} />
          <Info label="Location" value={lawyer.district || lawyer.officeAddress || u.location || "N/A"} icon={MapPin} />
          <Info label="Languages" value={lawyer.languages?.join(", ") || u.languages?.join(", ") || "N/A"} icon={FileText} />
          <Info label="Practice Areas" value={lawyer.practiceAreas?.join(", ") || "N/A"} icon={Briefcase} />
          <Info label="Rating" value={`${(lawyer.rating || 0).toFixed(1)} / 5.0`} icon={Star} />
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