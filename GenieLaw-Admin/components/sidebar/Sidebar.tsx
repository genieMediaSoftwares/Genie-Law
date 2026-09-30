"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Briefcase,
  Clock,
  Calendar,
  FileText,
  CreditCard,
  Crown,
  Star,
  AlertTriangle,
  Flame,
  FolderTree,
  Tag,
  Bell,
  Scale,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  Scale as LogoIcon,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/authStore";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "main" },
  { label: "Lawyers", href: "/lawyers", icon: Users, group: "main" },
  { label: "Lawyer Verification", href: "/lawyer-verification", icon: UserCheck, group: "main" },
  { label: "Clients", href: "/clients", icon: Users, group: "main" },
  { label: "Cases", href: "/cases", icon: Briefcase, group: "cases" },
  { label: "Urgent Cases", href: "/urgent-cases", icon: Flame, group: "cases" },
  { label: "Appointments", href: "/appointments", icon: Calendar, group: "operations" },
  { label: "Documents", href: "/documents", icon: FileText, group: "operations" },
  { label: "Payments", href: "/payments", icon: CreditCard, group: "financial" },
  { label: "Subscriptions", href: "/subscriptions", icon: Crown, group: "financial" },
  { label: "Reviews", href: "/reviews", icon: Star, group: "content" },
  { label: "Disputes", href: "/disputes", icon: AlertTriangle, group: "content" },
  { label: "Categories", href: "/categories", icon: FolderTree, group: "content" },
  { label: "Promotions", href: "/promotions", icon: Tag, group: "content" },
  { label: "Notifications", href: "/notifications", icon: Bell, group: "system" },
  { label: "Legal Documents", href: "/legal", icon: Scale, group: "system" },
  { label: "Audit Logs", href: "/audit-logs", icon: ShieldAlert, group: "system" },
  { label: "Settings", href: "/settings", icon: Settings, group: "system" },
];

const groupLabels: Record<string, string> = {
  main: "Overview",
  cases: "Legal Cases",
  operations: "Operations",
  financial: "Financial",
  content: "Content",
  system: "System",
};

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuthStore();

  const groupedItems = menuItems.reduce<Record<string, typeof menuItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 border-r border-slate-800 transition-all duration-300 z-30",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-black shadow-lg">
                <LogoIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-extrabold text-white text-base tracking-tight leading-none">
                  GENIE <span className="text-gold">LAW</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">
                  Admin Panel
                </p>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="mx-auto">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-black shadow-lg">
              <LogoIcon className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {!collapsed && (
          <div className="px-4 mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Navigation</p>
          </div>
        )}

        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group} className="mb-1">
            {!collapsed && (
              <div className="px-4 py-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{groupLabels[group] || group}</p>
              </div>
            )}
            <div className="px-2 space-y-0.5">
              {items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative",
                      isActive
                        ? "sidebar-link-active text-gold"
                        : "sidebar-link-inactive",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-gold" : "text-slate-400")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}

                    {/* Active indicator dot for collapsed mode */}
                    {isActive && collapsed && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-gold" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Section */}
      <div className="border-t border-slate-800 p-3">
        {!collapsed ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/20 to-amber-500/20 border border-gold/30 flex items-center justify-center font-bold text-gold text-sm shrink-0">
                {user?.fullName ? user.fullName[0].toUpperCase() : "A"}
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || "Administrator"}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email || "Admin"}</p>
              </div>
              <Shield className="w-3.5 h-3.5 text-gold shrink-0" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-700 mb-1">
                    <p className="font-semibold text-slate-200 text-sm truncate">{user?.fullName}</p>
                    <span className="text-[10px] text-slate-400">{user?.email}</span>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700/50 transition-colors text-sm"
                  >
                    <User className="w-4 h-4 text-slate-400" /> Account Settings
                  </Link>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
