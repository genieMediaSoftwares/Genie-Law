"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Bell,
  AlertTriangle,
  Mail,
  UserCheck,
  Briefcase,
  CreditCard,
  Star,
  CheckCircle,
  Clock,
  ShieldAlert,
  Flame,
  Tag,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const [broadcastText, setBroadcastText] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: async () => await adminApi.getNotifications({ page: 1, limit: 50 }),
  });

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    try {
      setIsBroadcasting(true);
      await adminApi.broadcastNotification({ title: "Platform Announcement", message: broadcastText });
      toast.success("Notification broadcasted to all users");
      setBroadcastText("");
    } catch {
      toast.error("Broadcast failed");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const notificationIcon = (type?: string) => {
    switch (type) {
      case "lawyer": return UserCheck;
      case "case": return Briefcase;
      case "payment": return CreditCard;
      case "review": return Star;
      case "urgent": return Flame;
      case "dispute": return ShieldAlert;
      case "system": return Bell;
      case "promotion": return Tag;
      case "verification": return UserCheck;
      default: return Bell;
    }
  };

  const notificationColor = (type?: string) => {
    switch (type) {
      case "urgent": return "bg-red-100 text-red-700";
      case "payment": return "bg-emerald-100 text-emerald-700";
      case "dispute": return "bg-orange-100 text-orange-700";
      case "lawyer": return "bg-blue-100 text-blue-700";
      case "case": return "bg-purple-100 text-purple-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Notification Center</h1>
        <p className="section-subtitle">Manage platform-wide notifications and broadcast messages</p>
      </div>

      {/* Broadcast Form */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gold" /> Broadcast to All Users
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Send a platform-wide notification to every registered user</p>
        </div>
        <div className="card-body">
          <form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="label-field">Message</label>
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Enter notification message..."
                className="form-input"
              />
            </div>
            <button
              type="submit"
              disabled={isBroadcasting || !broadcastText.trim()}
              className="btn btn-primary text-xs px-6 py-2.5 whitespace-nowrap"
            >
              {isBroadcasting ? "Broadcasting..." : "Send Broadcast"}
            </button>
          </form>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Events</h2>
            <p className="text-xs text-slate-500 mt-0.5">{notifications.length} events logged</p>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading notifications...</p></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state"><Bell className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No notifications yet</p><p className="text-xs text-slate-400">Events will appear here in real-time</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n: any) => {
              const Icon = notificationIcon(n.type);
              return (
                <div key={n._id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", notificationColor(n.type))}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{n.title || n.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{n.description || n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0",
                    notificationColor(n.type)
                  )}>
                    {n.type}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}