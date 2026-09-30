import React from "react";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// How an account proved who it is: email / mobile OTP and Google. Read-only;
// OTP codes are never sent to the admin panel.
type Account = {
  emailVerifiedAt?: string | null;
  mobileVerifiedAt?: string | null;
  googleLinkedAt?: string | null;
  authProviders?: string[];
  requiresContactVerification?: boolean | null;
};

const Pill = ({ ok, label, title }: { ok: boolean; label: string; title: string }) => (
  <span
    title={title}
    className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border",
      ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200"
    )}
  >
    {ok ? "✓" : "✗"} {label}
  </span>
);

export function ContactVerification({ account }: { account: Account }) {
  const google = Boolean(account.googleLinkedAt) || (account.authProviders || []).includes("google");
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      <Pill
        ok={Boolean(account.emailVerifiedAt)}
        label="Email"
        title={account.emailVerifiedAt ? `Email verified ${formatDateTime(account.emailVerifiedAt)}` : "Email not verified"}
      />
      <Pill
        ok={Boolean(account.mobileVerifiedAt)}
        label="Mobile"
        title={account.mobileVerifiedAt ? `Mobile verified ${formatDateTime(account.mobileVerifiedAt)}` : "Mobile not verified"}
      />
      {google ? (
        <Pill ok label="Google" title={account.googleLinkedAt ? `Google linked ${formatDateTime(account.googleLinkedAt)}` : "Google sign-in"} />
      ) : null}
      {account.requiresContactVerification ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-100">
          Pending verification
        </span>
      ) : null}
    </div>
  );
}
