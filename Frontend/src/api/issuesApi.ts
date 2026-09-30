import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type { Issue } from '../types/domain';

export const issuesApi = {
  async list(): Promise<Issue[]> {
    const response = await apiClient.get<ApiSuccess<Issue[]>>('/issues');
    return unwrap(response) ?? [];
  },

  async create(input: {
    title: string;
    description: string;
    category: string;
    urgency?: string;
    preferredMode?: string;
    location?: string;
  }): Promise<Issue> {
    const response = await apiClient.post<ApiSuccess<Issue>>('/issues/create', input);
    return unwrap(response);
  },

  async getById(id: string): Promise<Issue> {
    const response = await apiClient.get<ApiSuccess<Issue>>(`/issues/${id}`);
    return unwrap(response);
  },

  async update(id: string, data: { status?: string }): Promise<Issue> {
    const response = await apiClient.put<ApiSuccess<Issue>>(`/issues/${id}`, data);
    return unwrap(response);
  },
};
