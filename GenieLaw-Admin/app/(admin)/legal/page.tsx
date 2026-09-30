"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import { FileText, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, apiErrorMessage } from "@/lib/utils";

// LegalDocument.type values (backend/src/models/index.js) and who they apply to.
const LEGAL_DOCS = [
  { type: "platform_terms", label: "Platform Terms", description: "Terms for everyone using the platform", icon: "📋", audience: "all" },
  { type: "client_terms", label: "Client Terms", description: "Client service terms", icon: "📑", audience: "client" },
  { type: "lawyer_terms", label: "Lawyer Terms", description: "Advocate-specific agreement", icon: "⚖️", audience: "lawyer" },
  { type: "privacy_policy", label: "Privacy Policy", description: "Data handling and privacy notices", icon: "🔒", audience: "all" },
  { type: "refund_policy", label: "Refund Policy", description: "Payment and refund rules", icon: "💳", audience: "all" },
  { type: "ai_disclaimer", label: "AI Disclaimer", description: "Limitations of AI-generated content", icon: "🤖", audience: "all" },
  { type: "communication_consent", label: "Communication Consent", description: "Consent to be contacted", icon: "💬", audience: "all" },
  { type: "document_sharing_consent", label: "Document Sharing Consent", description: "Consent to share case documents", icon: "📂", audience: "all" },
] as const;

type LegalDocument = {
  _id: string;
  type: string;
  version: string;
  title: string;
  content: string;
  audience: string;
  isActive: boolean;
  requiresAcceptance: boolean;
  effectiveDate: string;
};

// "1.0" -> "2.0"; anything unparseable -> one more than the number of versions.
const nextVersion = (versions: LegalDocument[]) => {
  const majors = versions.map((d) => Number.parseInt(d.version, 10)).filter(Number.isFinite);
  return `${(majors.length ? Math.max(...majors) : versions.length) + 1}.0`;
};

export default function LegalDocumentsPage() {
  const queryClient = useQueryClient();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const { data: documents = [], isLoading, isError } = useQuery<LegalDocument[]>({
    queryKey: ["admin", "legal-docs"],
    queryFn: adminApi.getLegalDocuments,
  });

  const byType = useMemo(() => {
    const map: Record<string, { active?: LegalDocument; versions: LegalDocument[] }> = {};
    for (const doc of documents) {
      const entry = (map[doc.type] ||= { versions: [] });
      entry.versions.push(doc);
      if (doc.isActive) entry.active = doc;
    }
    return map;
  }, [documents]);

  const editing = LEGAL_DOCS.find((d) => d.type === editingType);
  const current = editingType ? byType[editingType] : undefined;

  const publishMutation = useMutation({
    mutationFn: () => {
      const meta = editing!;
      return adminApi.createLegalDocument({
        type: meta.type,
        version: nextVersion(current?.versions || []),
        title: current?.active?.title || meta.label,
        content,
        audience: current?.active?.audience || meta.audience,
        isActive: true,
        requiresAcceptance: current?.active?.requiresAcceptance ?? false,
      });
    },
    onSuccess: () => {
      toast.success("New version published");
      setEditingType(null);
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["admin", "legal-docs"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const startEditing = (type: string) => {
    if (editingType === type) return;
    setEditingType(type);
    setContent(byType[type]?.active?.content || "");
  };

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Legal Documents</h1>
        <p className="section-subtitle">Manage platform legal policies, terms of service, and disclosures</p>
      </div>

      {isError ? (
        <div className="card"><div className="empty-state"><AlertTriangle className="w-10 h-10 text-red-400 mb-2" /><p className="text-sm font-semibold text-red-600">Failed to load legal documents</p></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {LEGAL_DOCS.map((doc) => {
              const active = byType[doc.type]?.active;
              return (
                <button
                  key={doc.type}
                  onClick={() => startEditing(doc.type)}
                  disabled={isLoading}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all",
                    editingType === doc.type
                      ? "border-gold bg-gold-light shadow-sm"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white"
                  )}
                >
                  <div className="text-2xl mb-1">{doc.icon}</div>
                  <p className="text-sm font-semibold text-slate-900">{doc.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {active ? `Version ${active.version} · effective ${formatDate(active.effectiveDate)}` : "Not published yet"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2 card">
            {editing ? (
              <>
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{editing.label}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Publishing creates version {nextVersion(current?.versions || [])} and makes it the active one.
                        Earlier versions are kept.
                      </p>
                    </div>
                    <button
                      onClick={() => publishMutation.mutate()}
                      disabled={publishMutation.isPending || !content.trim()}
                      className="btn btn-primary text-xs px-4 py-2"
                    >
                      <Save className="w-3.5 h-3.5" /> {publishMutation.isPending ? "Publishing..." : "Publish"}
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter legal document content..."
                    rows={20}
                    className="form-textarea w-full font-mono text-sm leading-relaxed"
                  />
                </div>
              </>
            ) : (
              <div className="card-body">
                <div className="empty-state">
                  <FileText className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Select a document to edit</p>
                  <p className="text-xs text-slate-400 mt-1">Choose a legal document from the list</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
