import { apiClient, unwrap } from './apiClient';
import { env } from '../config/env';
import type { ApiSuccess } from '../types/api';
import type { LegalAcceptance, LegalDocument, LegalDocumentType } from '../types/legal';

// Mirrors /legal on the backend. Reading documents is public so terms and
// privacy can be shown before sign-in; acceptance needs a session.
export const legalApi = {
  async listActive(audience?: 'client' | 'lawyer'): Promise<LegalDocument[]> {
    const response = await apiClient.get<ApiSuccess<LegalDocument[]>>('/legal/documents', {
      params: audience ? { audience } : undefined,
    });
    return unwrap(response) ?? [];
  },

  async getByType(type: LegalDocumentType): Promise<LegalDocument> {
    const response = await apiClient.get<ApiSuccess<LegalDocument>>(
      `/legal/documents/${encodeURIComponent(type)}`,
    );
    return unwrap(response);
  },

  // Active documents this user still has to accept.
  async listPending(): Promise<LegalDocument[]> {
    const response = await apiClient.get<ApiSuccess<LegalDocument[]>>('/legal/pending');
    return unwrap(response) ?? [];
  },

  async accept(type: LegalDocumentType, version: string): Promise<void> {
    await apiClient.post<ApiSuccess<LegalAcceptance>>('/legal/accept', {
      type,
      version,
      appVersion: env.appVersion,
    });
  },

  async myAcceptances(): Promise<LegalAcceptance[]> {
    const response = await apiClient.get<ApiSuccess<LegalAcceptance[]>>('/legal/acceptances');
    return unwrap(response) ?? [];
  },
};
