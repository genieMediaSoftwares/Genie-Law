"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/adminApi";
import {
  Search,
  FolderTree,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn, apiErrorMessage } from "@/lib/utils";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories", search],
    queryFn: adminApi.getCategories,
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => adminApi.createCategory(data),
    onSuccess: () => {
      toast.success("New legal category added");
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (err: any) => toast.error(apiErrorMessage(err)),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    createCategoryMutation.mutate({ name, description });
  };

  const filteredCategories = categories.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div>
        <h1 className="section-title">Practice Area Categories</h1>
        <p className="section-subtitle">Configure legal categories available across client and lawyer applications</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-gold" /> Add Category
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Create a new practice area</p>
          </div>
          <div className="card-body">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label-field">Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Cyber Law"
                  required
                  className="form-input"
                />
              </div>
              <div>
                <label className="label-field">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of practice area..."
                  rows={3}
                  className="form-textarea"
                />
              </div>
              <button
                type="submit"
                disabled={createCategoryMutation.isPending}
                className="w-full btn btn-primary text-xs py-2.5"
              >
                {createCategoryMutation.isPending ? "Adding..." : "Add Practice Category"}
              </button>
            </form>
          </div>
        </div>

        {/* Categories List */}
        <div className="lg:col-span-2 card flex flex-col">
          <div className="card-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Categories</h2>
              <p className="text-xs text-slate-500 mt-0.5">{filteredCategories.length} total</p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter categories..."
                className="search-input !py-1.5 !text-xs !pl-8"
              />
            </div>
          </div>

          <div className="flex-1">
            {isLoading ? (
              <div className="loading-state"><div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Loading categories...</p></div>
            ) : filteredCategories.length === 0 ? (
              <div className="empty-state"><AlertTriangle className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-semibold text-slate-700">No categories found</p></div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category Name</th>
                      <th>Description</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((c: any) => (
                      <tr key={c._id}>
                        <td className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-slate-400" /> {c.name}
                        </td>
                        <td className="text-xs text-slate-600">{c.description || "N/A"}</td>
                        <td>
                          <span className={c.status === "inactive" ? "badge badge-warning" : "badge badge-success"}>
                            {c.status === "inactive" ? "Inactive" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}