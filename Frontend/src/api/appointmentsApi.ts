import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type { Appointment, AppointmentStatus } from '../types/lawyer';

// Client-side view of the shared /appointments routes. The backend scopes the
// list to the signed-in user, and only the two people in an appointment may
// change it.
export const appointmentsApi = {
  async list(): Promise<Appointment[]> {
    const response = await apiClient.get<ApiSuccess<Appointment[]>>('/appointments');
    return unwrap(response) ?? [];
  },

  // Booked by a client: the backend takes the advocate from `lawyer` and the
  // client from the session.
  async book(input: {
    lawyer: string;
    date: string;
    timeSlot: string;
    mode: Appointment['mode'];
    caseId?: string;
    notes?: string;
  }): Promise<Appointment> {
    const response = await apiClient.post<ApiSuccess<Appointment>>(
      '/appointments',
      input,
    );
    return unwrap(response);
  },

  async updateStatus(
    appointmentId: string,
    status: AppointmentStatus,
  ): Promise<Appointment> {
    const response = await apiClient.put<ApiSuccess<Appointment>>(
      `/appointments/${encodeURIComponent(appointmentId)}/status`,
      { status },
    );
    return unwrap(response);
  },

  async cancel(appointmentId: string): Promise<void> {
    await apiClient.delete(`/appointments/${encodeURIComponent(appointmentId)}`);
  },
};
