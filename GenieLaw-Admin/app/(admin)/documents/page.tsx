"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  FileText,
  Download,
  Eye,
  AlertTriangle,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Cookies from "js-cookie";
import { API_ORIGIN } from "@/lib/api/axios";

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewer, setViewer] = useState<{ filePath: string; mimeType?: string; name: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "documents", search, page],
    queryFn: () => adminApi.getDocuments({ page, limit: 20, search }),
  });

  const documents = data?.data || [];
  const totalPages = data?.pages || 1;

  const fileExt = (name?: string) => {
    if (!name) return "FILE";
    const m = name.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toUpperCase() : "FILE";
  };

  const typeLabel = (mimeType?: string) => {
    if (!mimeType) return "File";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.startsWith("image/")) return "Image";
    if (mimeType.includes("word")) return "Word document";
    if (mimeType.startsWith("text/")) return "Text";
    return "File";
  };

  const open = async (filePath: string) => {
    try {
      await adminApi.openFile(filePath);
    } catch {
      toast.error("The document could not be opened");
    }
  };

  // True for types the browser can preview inline.
  const canInlineView = (mimeType?: string) => {
    if (!mimeType) return false;
    return (
      mimeType.startsWith("image/") ||
      mimeType === "application/pdf" ||
      mimeType.startsWith("text/") ||
      mimeType === "application/json"
    );
  };

  const formatSize = (bytes?: number) =>
    !bytes ? "" : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const extColor = (ext: string) => {
    if (ext === "PDF") return "bg-red-100 text-red-700 border-red-200";
    if (["DOC", "DOCX"].includes(ext)) return "bg-blue-100 text-blue-700 border-blue-200";
    if (["JPG", "JPEG", "PNG"].includes(ext)) return "bg-violet-100 text-violet-700 border-violet-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Document Repository</h1>
        <p className="section-subtitle">Browse and manage all case-related documents uploaded on the platform</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search file, client or case..."
              className="search-input"
            />
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading documents...</p></div>
        ) : isError ? (
          <div className="empty-state"><AlertTriangle className="w-10 h-10 text-red-400 mb-2" /><p className="text-sm font-semibold text-red-600">Failed to load documents</p></div>
        ) : documents.length === 0 ? (
          <div className="empty-state"><FileText className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No documents found</p></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Case</th>
                  <th>Uploaded</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d: any) => {
                  const name = d.name || d.originalName || "Untitled";
                  const ext = fileExt(d.originalName || d.name);
                  return (
                    <tr key={d._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className={cn("px-2 py-1 rounded text-[10px] font-bold border", extColor(ext))}>{ext}</span>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{name}</p>
                            <p className="text-xs text-slate-500">{formatSize(d.fileSize)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-slate-600 font-medium">{typeLabel(d.mimeType)}</td>
                      <td className="text-xs text-slate-700">{d.clientId?.fullName || "—"}</td>
                      <td className="text-xs font-medium text-slate-700">{d.caseId?.title || "Not linked to a case"}</td>
                      <td className="text-xs text-slate-500">{formatDate(d.createdAt)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canInlineView(d.mimeType) && (
                            <button type="button" onClick={() => setViewer({ filePath: d.filePath, mimeType: d.mimeType, name })} className="action-link" title="View">
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                          )}
                          <button type="button" onClick={() => open(d.filePath)} className="action-link" title="Download">
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="pagination-btn">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="pagination-btn">Next</button>
            </div>
          </div>
        )}
      </div>

      {viewer && (
        <DocumentViewer
          filePath={viewer.filePath}
          mimeType={viewer.mimeType}
          name={viewer.name}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

// Inline viewer modal — loads the file through the authenticated /uploads/
// endpoint and renders it in the browser for PDFs, images and text.
function DocumentViewer({ filePath, mimeType, name, onClose }: { filePath: string; mimeType?: string; name: string; onClose: () => void }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const token = Cookies.get("admin_token") || localStorage.getItem("admin_token");
    const downloadUrl = `${API_ORIGIN}/${String(filePath || "").replace(/^\/+/, "")}`;

    fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("fetch_failed");
        const blob = await res.blob();
        if (cancelled) return;
        setUrl(URL.createObjectURL(blob));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  React.useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isText = mimeType?.startsWith("text/") || mimeType === "application/json";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {loading && <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div>}
          {error && <p className="text-sm text-red-600 text-center py-8">Unable to load this document. It may be corrupted or inaccessible.</p>}
          {!loading && !error && url && isImage && (
            <img src={url} alt={name} className="max-w-full max-h-[75vh] mx-auto rounded" />
          )}
          {!loading && !error && url && isPdf && (
            <iframe src={url} className="w-full h-[75vh] rounded" title={name} />
          )}
          {!loading && !error && url && isText && (
            <iframe src={url} className="w-full h-[75vh] rounded border border-slate-200" title={name} />
          )}
          {!loading && !error && url && !isImage && !isPdf && !isText && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-600 mb-3">This file type cannot be previewed inline.</p>
              <a href={url} download={name} className="btn btn-primary text-xs">Download file</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}