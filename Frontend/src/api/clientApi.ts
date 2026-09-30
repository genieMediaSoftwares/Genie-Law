import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type {
  ClientProfileResponse,
  ClientStats,
  NotificationPage,
} from '../types/domain';

export const clientApi = {
  async getProfile(): Promise<ClientProfileResponse> {
    const response = await apiClient.get<ApiSuccess<ClientProfileResponse>>(
      '/client/profile',
    );
    return unwrap(response);
  },

  async getStats(): Promise<ClientStats> {
    const response = await apiClient.get<ApiSuccess<ClientStats>>(
      '/client/stats',
    );
    return unwrap(response);
  },

  async getActivity(): Promise<unknown> {
    const response = await apiClient.get<ApiSuccess<unknown>>(
      '/client/activity',
    );
    return unwrap(response);
  },

  async updateProfile(payload: {
    fullName?: string;
    mobile?: string;
    location?: string;
    dob?: string;
    gender?: string;
    languages?: string[];
  }): Promise<ClientProfileResponse> {
    const response = await apiClient.put<ApiSuccess<ClientProfileResponse>>(
      '/client/profile',
      payload,
    );
    return unwrap(response);
  },
};

export const notificationsApi = {
  async list(page = 1, limit = 15): Promise<NotificationPage> {
    const response = await apiClient.get<ApiSuccess<NotificationPage>>(
      '/notifications',
      { params: { page: String(page), limit: String(limit) } },
    );
    return unwrap(response);
  },

  async markRead(id: string): Promise<void> {
    await apiClient.put<ApiSuccess<unknown>>(
      `/notifications/${encodeURIComponent(id)}/read`,
    );
  },

  async markAllRead(): Promise<void> {
    await apiClient.put<ApiSuccess<unknown>>('/notifications/read-all');
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<ApiSuccess<unknown>>(
      `/notifications/${encodeURIComponent(id)}`,
    );
  },

  async clearAll(): Promise<void> {
    await apiClient.delete<ApiSuccess<unknown>>('/notifications/clear-all');
  },
};
