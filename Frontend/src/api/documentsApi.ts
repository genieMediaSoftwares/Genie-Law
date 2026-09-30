import { apiClient, unwrap, UPLOAD_TIMEOUT_MS } from './apiClient';
import { env } from '../config/env';
import type { ApiSuccess } from '../types/api';
import type { AppDocument } from '../types/domain';

export interface DocxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface DocxPreviewBlock {
  type: 'heading' | 'paragraph' | 'listItem' | 'table' | 'spacer' | string;
  level?: number;
  indent?: number;
  text?: string;
  runs?: DocxRun[];
  rows?: string[][];
  heading?: boolean;
  items?: string[];
}

export interface DocxPreviewResult {
  documentId?: string;
  name: string;
  mimeType?: string;
  blocks: DocxPreviewBlock[];
  truncated?: boolean;
}

export const documentsApi = {
  async getDocuments(params?: { search?: string; type?: string; sort?: string }): Promise<AppDocument[]> {
    const response = await apiClient.get<ApiSuccess<AppDocument[]>>('/documents', {
      params,
    });
    return unwrap(response);
  },

  async getDocumentById(id: string): Promise<AppDocument> {
    const response = await apiClient.get<ApiSuccess<AppDocument>>(
      `/documents/${encodeURIComponent(id)}`,
    );
    return unwrap(response);
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete<ApiSuccess<null>>(
      `/documents/${encodeURIComponent(id)}`,
    );
  },

  async renameDocument(id: string, name: string): Promise<AppDocument> {
    const response = await apiClient.patch<ApiSuccess<AppDocument>>(
      `/documents/${encodeURIComponent(id)}`,
      { name },
    );
    return unwrap(response);
  },

  async uploadDocument(formData: FormData): Promise<AppDocument> {
    const response = await apiClient.post<ApiSuccess<AppDocument>>(
      '/documents/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: UPLOAD_TIMEOUT_MS,
      },
    );
    return unwrap(response);
  },

  async replaceDocument(id: string, formData: FormData): Promise<AppDocument> {
    const response = await apiClient.post<ApiSuccess<AppDocument>>(
      `/documents/${encodeURIComponent(id)}/replace`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: UPLOAD_TIMEOUT_MS,
      },
    );
    return unwrap(response);
  },

  async getPreview(id: string): Promise<DocxPreviewResult> {
    const response = await apiClient.get<ApiSuccess<DocxPreviewResult>>(
      `/documents/${encodeURIComponent(id)}/preview`,
    );
    return unwrap(response);
  },

  getViewUrl(id: string): string {
    return `${env.apiBaseUrl}/documents/${encodeURIComponent(id)}/view`;
  },

  getDownloadUrl(id: string): string {
    return `${env.apiBaseUrl}/documents/${encodeURIComponent(id)}/download`;
  },

  async fetchViewBlob(id: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/documents/${encodeURIComponent(id)}/view`,
      { responseType: 'blob' },
    );
    return response.data;
  },

  async fetchDownloadBlob(id: string): Promise<{ blob: Blob; filename?: string }> {
    const response = await apiClient.get<Blob>(
      `/documents/${encodeURIComponent(id)}/download`,
      { responseType: 'blob' },
    );
    const disposition = String(response.headers['content-disposition'] || '');
    const match = /filename\*?=['"]?(?:UTF-8'')?([^'";\n]+)['"]?/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : undefined;
    return { blob: response.data, filename };
  },
};
