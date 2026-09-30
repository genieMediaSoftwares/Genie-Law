"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authStore";
import { Bell, Search, LogOut, User as UserIcon, Shield, Menu, X, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-3 md:gap-4 flex-1 max-w-2xl">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search */}
        {!searchOpen ? (
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 transition-all min-w-[280px]"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden md:inline-block text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">⌘K</kbd>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-gold rounded-lg min-w-[280px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-gold shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search anything..."
              onBlur={() => setSearchOpen(false)}
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button onClick={() => setSearchOpen(false)} className="p-0.5 hover:bg-slate-200 rounded">
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold rounded-full ring-2 ring-white animate-pulse" />
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="font-semibold text-slate-900 text-sm">Notifications</p>
                <Link
                  href="/notifications"
                  onClick={() => setShowNotifMenu(false)}
                  className="text-xs font-semibold text-gold-hover hover:underline"
                >
                  Broadcast
                </Link>
              </div>
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Real-time alerts appear here</p>
                <p className="text-[10px] text-slate-400 mt-1">Listening for platform events...</p>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/20 to-amber-500/20 border border-gold/30 flex items-center justify-center font-bold text-gold text-xs">
              {user?.fullName ? user.fullName[0].toUpperCase() : "A"}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.fullName || "Administrator"}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{user?.email || "Admin"}</p>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm truncate">{user?.fullName || "Administrator"}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email || "Admin"}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded mt-1.5 border border-amber-100">
                  <Shield className="w-3 h-3" /> System Admin
                </span>
              </div>
              <Link
                href="/settings"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors text-sm"
              >
                <SettingsIcon className="w-4 h-4 text-slate-500" /> Account Settings
              </Link>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium border-t border-slate-100"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
