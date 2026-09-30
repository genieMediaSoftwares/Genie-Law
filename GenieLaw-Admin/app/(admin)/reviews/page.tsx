"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  Star,
  Eye,
  AlertTriangle,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Trash2,
} from "lucide-react";
import { formatDate, apiErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "reviews", search, status, page],
    queryFn: () => adminApi.getReviews({ page, limit: 15, search, status }),
  });

  // Reviews carry isReported (flagged for moderation) and isHidden.
  const updateStatusMutation = useMutation({
    mutationFn: ({ reviewId, patch }: { reviewId: string; patch: { isHidden?: boolean; isReported?: boolean } }) =>
      adminApi.updateReviewVisibility(reviewId, patch),
    onSuccess: () => {
      toast.success("Review updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason: string }) =>
      adminApi.deleteReview(reviewId, reason),
    onSuccess: () => {
      toast.success("Review removed and rating recalculated");
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const removeReview = (reviewId: string) => {
    const reason = window.prompt("Why is this review being removed? (recorded in the audit log)");
    if (reason && reason.trim()) deleteMutation.mutate({ reviewId, reason: reason.trim() });
  };

  const reviews = data?.data || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Review Moderation</h1>
        <p className="section-subtitle">Monitor client feedback and moderate published reviews</p>
      </div>

      <div className="card">
        <div className="card-body flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by client, lawyer name..."
              className="search-input"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="form-select w-full sm:w-auto"
            >
              <option value="all">All Reviews</option>
              <option value="published">Published</option>
              <option value="flagged">Flagged</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading reviews...</p></div>
        ) : isError ? (
          <div className="empty-state">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm font-semibold text-red-600">Failed to load reviews</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })} className="btn btn-secondary mt-3 text-xs">Retry</button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="card"><div className="empty-state"><Star className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No reviews found</p></div></div>
        ) : (
          reviews.map((r: any) => {
            const avg = r.rating || 0;
            return (
              <div key={r._id} className="card">
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/20 to-amber-500/20 flex items-center justify-center font-bold text-slate-800 text-sm border border-gold/20 shrink-0">
                        {(r.client?.fullName || "U")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm">{r.client?.fullName || "Anonymous"}</p>
                        <p className="text-xs text-slate-500">reviewed {r.lawyer?.fullName || "Advocate"}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("w-3.5 h-3.5", i < avg ? "text-amber-400 fill-amber-400" : "text-slate-300")} />
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(r.createdAt)}</p>
                    </div>
                  </div>
                  {r.review && <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">{r.review}</p>}
                  {r.isHidden && (
                    <div className="mt-3 mr-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                      <Eye className="w-3.5 h-3.5" /> Hidden from the public profile
                    </div>
                  )}
                  {r.isReported && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-100">
                      <ThumbsDown className="w-3.5 h-3.5" /> Flagged — requires review
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    {!r.isReported ? (
                      <button onClick={() => updateStatusMutation.mutate({ reviewId: r._id, patch: { isReported: true } })} className="btn btn-secondary text-xs px-3 py-1.5">
                        <ThumbsDown className="w-3.5 h-3.5" /> Flag
                      </button>
                    ) : (
                      <button onClick={() => updateStatusMutation.mutate({ reviewId: r._id, patch: { isReported: false } })} className="btn btn-success text-xs px-3 py-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    <button onClick={() => updateStatusMutation.mutate({ reviewId: r._id, patch: { isHidden: !r.isHidden } })} className="btn btn-secondary text-xs px-3 py-1.5">
                      <Eye className="w-3.5 h-3.5" /> {r.isHidden ? "Show" : "Hide"}
                    </button>
                    <button onClick={() => removeReview(r._id)} disabled={deleteMutation.isPending} className="btn btn-danger text-xs px-3 py-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && reviews.length > 0 && (
        <div className="card px-6 py-4 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="pagination-btn">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="pagination-btn">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}