import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

export function formatCurrency(amount?: number | null, currency = "INR"): string {
  if (amount === undefined || amount === null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// The message to show for a failed request: the backend's own message when it
// sent one, otherwise the error's (e.g. network failure, timeout).
export function apiErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
  const fromBackend = e?.response?.data?.message;
  if (typeof fromBackend === "string" && fromBackend.trim()) return fromBackend;
  return String(e?.message);
}
