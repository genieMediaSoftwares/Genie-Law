import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type {
  Appointment,
  HearingInput,
  LawyerNote,
  LawyerNoteInput,
  LawyerClientDetail,
  LawyerClientGroups,
  LawyerHearing,
  LawyerLead,
  LawyerProfileDetail,
  LawyerProfileUpdate,
  LawyerScheduleEvent,
  LawyerUnreadMessages,
  SubscriptionInfo,
} from '../types/lawyer';

export const lawyerApi = {
  async getLeads(): Promise<LawyerLead[]> {
    const response = await apiClient.get<ApiSuccess<LawyerLead[]>>(
      '/lawyers/leads',
    );
    return unwrap(response) ?? [];
  },

  async getClients(): Promise<LawyerClientGroups> {
    const response = await apiClient.get<ApiSuccess<LawyerClientGroups>>(
      '/lawyers/clients',
    );
    return (
      unwrap(response) ?? { accepted: [], inProgress: [], closed: [] }
    );
  },

  async getClientDetails(clientId: string): Promise<LawyerClientDetail> {
    const response = await apiClient.get<ApiSuccess<LawyerClientDetail>>(
      `/clients/${encodeURIComponent(clientId)}`,
    );
    return unwrap(response);
  },

  async getScheduleToday(): Promise<LawyerScheduleEvent[]> {
    const response = await apiClient.get<ApiSuccess<LawyerScheduleEvent[]>>(
      '/lawyers/schedule/today',
    );
    return unwrap(response) ?? [];
  },

  async getUnreadMessages(): Promise<LawyerUnreadMessages> {
    const response = await apiClient.get<ApiSuccess<LawyerUnreadMessages>>(
      '/lawyers/messages/unread',
    );
    return (
      unwrap(response) ?? {
        unreadCount: 0,
        conversationCount: 0,
        latestMessage: '',
        latestClient: '',
        lastMessageTime: null,
      }
    );
  },

  async getProfile(userId: string): Promise<LawyerProfileDetail> {
    const response = await apiClient.get<ApiSuccess<LawyerProfileDetail>>(
      `/lawyers/${userId}`,
    );
    return unwrap(response);
  },

  async updateProfile(
    payload: LawyerProfileUpdate,
  ): Promise<LawyerProfileDetail> {
    const response = await apiClient.put<ApiSuccess<LawyerProfileDetail>>(
      '/lawyers/profile',
      payload,
    );
    return unwrap(response);
  },

  async acceptLead(caseId: string): Promise<void> {
    await apiClient.post(`/cases/${caseId}/accept-request`);
  },

  async rejectLead(caseId: string): Promise<void> {
    await apiClient.post(`/cases/${caseId}/reject-request`);
  },

  async startCase(caseId: string): Promise<void> {
    await apiClient.post(`/cases/${caseId}/start`);
  },

  async markCaseCompleted(caseId: string): Promise<void> {
    await apiClient.post(`/cases/${caseId}/complete`);
  },

  async getHearings(): Promise<LawyerHearing[]> {
    const response = await apiClient.get<ApiSuccess<LawyerHearing[]>>(
      '/cases/hearings/mine',
    );
    return unwrap(response) ?? [];
  },

  async addHearing(caseId: string, payload: HearingInput): Promise<void> {
    await apiClient.post(`/cases/${encodeURIComponent(caseId)}/hearings`, payload);
  },

  async updateHearing(
    caseId: string,
    hearingId: string,
    payload: Partial<HearingInput>,
  ): Promise<void> {
    await apiClient.put(
      `/cases/${encodeURIComponent(caseId)}/hearings/${encodeURIComponent(
        hearingId,
      )}`,
      payload,
    );
  },

  async deleteHearing(caseId: string, hearingId: string): Promise<void> {
    await apiClient.delete(
      `/cases/${encodeURIComponent(caseId)}/hearings/${encodeURIComponent(
        hearingId,
      )}`,
    );
  },

  async getClientNotes(clientId: string, caseId?: string): Promise<LawyerNote[]> {
    const response = await apiClient.get<ApiSuccess<LawyerNote[]>>(
      `/clients/${encodeURIComponent(clientId)}/notes`,
      caseId ? { params: { caseId } } : undefined,
    );
    return unwrap(response) ?? [];
  },

  async addClientNote(
    clientId: string,
    payload: LawyerNoteInput,
  ): Promise<LawyerNote> {
    const response = await apiClient.post<ApiSuccess<LawyerNote>>(
      `/clients/${encodeURIComponent(clientId)}/notes`,
      payload,
    );
    return unwrap(response);
  },

  async updateClientNote(
    clientId: string,
    noteId: string,
    payload: LawyerNoteInput,
  ): Promise<LawyerNote> {
    const response = await apiClient.put<ApiSuccess<LawyerNote>>(
      `/clients/${encodeURIComponent(clientId)}/notes/${encodeURIComponent(
        noteId,
      )}`,
      payload,
    );
    return unwrap(response);
  },

  async deleteClientNote(clientId: string, noteId: string): Promise<void> {
    await apiClient.delete(
      `/clients/${encodeURIComponent(clientId)}/notes/${encodeURIComponent(
        noteId,
      )}`,
    );
  },

  async getAppointments(): Promise<Appointment[]> {
    const response = await apiClient.get<ApiSuccess<Appointment[]>>(
      '/appointments',
    );
    return unwrap(response) ?? [];
  },

  async createAppointment(payload: {
    client: string;
    date: string;
    timeSlot: string;
    mode: 'Chat' | 'In-Person';
    caseId?: string;
  }): Promise<Appointment> {
    const response = await apiClient.post<ApiSuccess<Appointment>>(
      '/appointments',
      payload,
    );
    return unwrap(response);
  },

  async updateAppointmentStatus(
    appointmentId: string,
    status: Appointment['status'],
  ): Promise<Appointment> {
    const response = await apiClient.put<ApiSuccess<Appointment>>(
      `/appointments/${appointmentId}/status`,
      { status },
    );
    return unwrap(response);
  },

  async cancelAppointment(appointmentId: string): Promise<void> {
    await apiClient.delete(`/appointments/${appointmentId}`);
  },

  async getSubscription(): Promise<SubscriptionInfo> {
    const response = await apiClient.get<ApiSuccess<SubscriptionInfo>>(
      '/subscriptions',
    );
    return unwrap(response);
  },
};
