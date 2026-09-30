"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Users,
  UserCheck,
  Briefcase,
  Calendar,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Clock,
  ShieldCheck,
  ChevronRight,
  Activity,
  CreditCard,
  Crown,
  Flame,
  Bell,
  Scale,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: adminApi.getDashboardStats,
  });

  const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: adminApi.getAnalyticsData,
  });

  const stats = statsData || {};
  const monthlyStats = analyticsData?.monthlyStats || [];
  const caseBreakdownData = [
    { name: "Pending", value: stats.casesOverview?.pending || 0, color: "#F59E0B" },
    { name: "In Progress", value: stats.casesOverview?.inProgress || 0, color: "#3B82F6" },
    { name: "Completed", value: stats.casesOverview?.completed || 0, color: "#10B981" },
    { name: "Closed", value: stats.casesOverview?.closed || 0, color: "#64748B" },
  ].filter((d) => d.value > 0);

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">System Dashboard</h1>
          <p className="section-subtitle">Real-time platform operations and metrics overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-hover text-black font-semibold rounded-lg shadow-sm text-sm transition-all"
          >
            <Bell className="w-4 h-4" />
            <span>Broadcast</span>
          </Link>
          <Link
            href="/lawyer-verification"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm text-sm transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-gold" />
            <span>Verify Lawyers</span>
          </Link>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Lawyers"
          value={stats.totalLawyers ?? (isStatsLoading ? "..." : 0)}
          subtitle={`${stats.approvedLawyers ?? 0} verified`}
          icon={Scale}
          accentColor="from-blue-500 to-blue-600"
          href="/lawyers"
        />
        <StatCard
          title="Total Clients"
          value={stats.totalClients ?? (isStatsLoading ? "..." : 0)}
          subtitle={`${stats.activeClients ?? 0} active`}
          icon={Users}
          accentColor="from-emerald-500 to-emerald-600"
          href="/clients"
        />
        <StatCard
          title="Active Cases"
          value={stats.activeCases ?? (isStatsLoading ? "..." : 0)}
          subtitle={`${stats.totalCases ?? 0} total`}
          icon={Briefcase}
          accentColor="from-amber-500 to-amber-600"
          href="/cases"
        />
        <StatCard
          title="Appointments"
          value={stats.totalAppointments ?? (isStatsLoading ? "..." : 0)}
          subtitle={`${stats.openAppointments ?? 0} upcoming`}
          icon={Calendar}
          accentColor="from-violet-500 to-violet-600"
          href="/appointments"
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat
          icon={ShieldCheck}
          label="Pending Verifications"
          value={stats.pendingVerifications ?? 0}
          loading={isStatsLoading}
          href="/lawyer-verification"
          bg="bg-amber-50"
          text="text-amber-700"
        />
        <MiniStat
          icon={Flame}
          label="Urgent Cases"
          value={stats.urgentCases ?? 0}
          loading={false}
          href="/urgent-cases"
          bg="bg-red-50"
          text="text-red-700"
        />
        <MiniStat
          icon={AlertTriangle}
          label="Open Disputes"
          value={stats.openSupportTickets ?? 0}
          loading={isStatsLoading}
          href="/disputes"
          bg="bg-orange-50"
          text="text-orange-700"
        />
        <MiniStat
          icon={Sparkles}
          label="AI Conversations"
          value={stats.totalAiRequests ?? 0}
          loading={isStatsLoading}
          href="#"
          bg="bg-violet-50"
          text="text-violet-700"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Trends Chart */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold" />
                Platform Growth
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">User registrations over the last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-gold-hover">
                <span className="w-2.5 h-2.5 bg-gold rounded-full" /> Clients
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="w-2.5 h-2.5 bg-slate-700 rounded-full" /> Lawyers
              </span>
              <span className="flex items-center gap-1 text-blue-700">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> Cases
              </span>
            </div>
          </div>
          <div className="card-body">
            <div className="h-72">
              {isAnalyticsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-sm text-slate-400">Loading growth data...</div>
                </div>
              ) : monthlyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F5B900" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F5B900" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorLawyers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F172A" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="clients" stroke="#F5B900" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClients)" />
                    <Area type="monotone" dataKey="lawyers" stroke="#0F172A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLawyers)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Activity className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No growth data available</p>
                  <p className="text-xs text-slate-400 mt-1">Data will appear as activity grows</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Case Status Distribution */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gold" />
              Case Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribution by current status</p>
          </div>
          <div className="card-body flex-1 flex flex-col">
            {caseBreakdownData.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={caseBreakdownData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {caseBreakdownData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-3">
                  {caseBreakdownData.map((s, i) => {
                    const total = caseBreakdownData.reduce((sum, x) => sum + x.value, 0);
                    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                          <span className="font-medium text-slate-700">{s.name}</span>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {s.value} <span className="text-slate-400">({pct}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <Briefcase className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No cases yet</p>
                <p className="text-xs text-slate-400 mt-1">Cases will appear once created</p>
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Resolution Rate</span>
            <span className="text-sm font-bold text-emerald-600">{analyticsData?.caseResolutionRate || "0%"}</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Registrations */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-gold" />
                Recent Users
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest registrations</p>
            </div>
            <Link
              href="/clients"
              className="text-xs font-semibold text-gold-hover hover:underline flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="card-body">
            {stats.recentRegistrations && stats.recentRegistrations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {stats.recentRegistrations.map((u: any) => (
                  <div key={u._id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                        u.role === "lawyer" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {u.fullName ? u.fullName[0].toUpperCase() : "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{u.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1",
                        u.role === "lawyer" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                      )}>
                        {u.role}
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium">{formatDate(u.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Users className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No recent users</p>
                <p className="text-xs text-slate-400 mt-1">New registrations will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Cases */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gold" />
                Recent Cases
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest legal case submissions</p>
            </div>
            <Link
              href="/cases"
              className="text-xs font-semibold text-gold-hover hover:underline flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="card-body">
            {stats.recentCases && stats.recentCases.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {stats.recentCases.map((c: any) => (
                  <div key={c._id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.client?.fullName || "No client"} • {c.category || "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ml-3",
                        c.status === "Closed" || c.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.status === "In Progress"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Briefcase className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No recent cases</p>
                <p className="text-xs text-slate-400 mt-1">New cases will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, accentColor, href }: any) {
  return (
    <Link href={href || "#"} className="stat-card block">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div
          className={cn(
            "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform",
            accentColor
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
    </Link>
  );
}

function MiniStat({ icon: Icon, label, value, loading, href, bg, text }: any) {
  const Wrapper: any = href ? Link : "div";
  const wrapperProps = href ? { href } : {};
  return (
    <Wrapper {...wrapperProps} className="stat-card block group">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg, text)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{label}</p>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{loading ? "..." : value}</p>
        </div>
        {href && (
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        )}
      </div>
    </Wrapper>
  );
}

function StatusProgress({ label, value, total, color }: any) {
  const percentage = Math.round((value / total) * 100) || 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-900">{value} ({percentage}%)</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}