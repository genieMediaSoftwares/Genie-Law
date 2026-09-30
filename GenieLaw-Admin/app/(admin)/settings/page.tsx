"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Settings,
  Save,
  Bell,
  Mail,
  Shield,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, apiErrorMessage } from "@/lib/utils";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    language: "English",
    twoFactorAuthentication: false,
  });

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  useEffect(() => {
    if (settingsData) {
      setSettings((prev) => ({ ...prev, ...settingsData }));
    }
  }, [settingsData]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateSettings(data),
    onSuccess: () => {
      toast.success("Admin preferences saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (err: any) => {
      toast.error(apiErrorMessage(err));
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(settings);
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">System Settings</h1>
        <p className="section-subtitle">Configure admin notification preferences, security, and platform defaults</p>
      </div>

      <div className="card max-w-3xl">
        <div className="card-header">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-gold" /> Platform Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">These preferences are applied across all admin accounts</p>
        </div>

        <div className="card-body">
          {isLoading ? (
            <div className="loading-state py-8">
              <div className="w-8 h-8 border-3 border-gold border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm text-slate-500">Loading settings...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Push Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Push Notifications</p>
                    <p className="text-xs text-slate-500">Alerts for new requests and urgent cases</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, pushNotifications: !settings.pushNotifications })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors duration-200 relative",
                    settings.pushNotifications ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200",
                      settings.pushNotifications ? "left-[22px]" : "left-[2px]"
                    )}
                  />
                </button>
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Email Notifications</p>
                    <p className="text-xs text-slate-500">Email alerts for audit logs and system events</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors duration-200 relative",
                    settings.emailNotifications ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200",
                      settings.emailNotifications ? "left-[22px]" : "left-[2px]"
                    )}
                  />
                </button>
              </div>

              {/* 2FA */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-500">Enforce extra security verification on admin login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, twoFactorAuthentication: !settings.twoFactorAuthentication })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors duration-200 relative",
                    settings.twoFactorAuthentication ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200",
                      settings.twoFactorAuthentication ? "left-[22px]" : "left-[2px]"
                    )}
                  />
                </button>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">System Language</p>
                    <p className="text-xs text-slate-500">Default language for admin interface</p>
                  </div>
                </div>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="form-select w-40"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="btn btn-primary w-full py-3 text-sm"
              >
                <Save className="w-4 h-4" />
                {updateSettingsMutation.isPending ? "Saving Changes..." : "Save Configuration"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}