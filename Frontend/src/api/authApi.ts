import { apiClient, unwrap, UPLOAD_TIMEOUT_MS } from './apiClient';
import { getDeviceContext } from '../services/device';
import type { ApiSuccess } from '../types/api';
import { env } from '../config/env';
import type {
  AuthSession,
  LogoutAllResult,
  OtpChannel,
  OtpSent,
  PendingVerification,
  ProfileUser,
  SignupRole,
} from '../types/auth';

export const authApi = {
  async signup(input: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    role: SignupRole;
  }): Promise<PendingVerification> {
    const device = await getDeviceContext();

    const response = await apiClient.post<ApiSuccess<PendingVerification>>(
      '/auth/signup',
      { ...input, ...device },
    );

    return unwrap(response);
  },

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const device = await getDeviceContext();

    const response = await apiClient.post<ApiSuccess<AuthSession>>(
      '/auth/login',
      { ...input, ...device },
    );

    return unwrap(response);
  },

  async requestOtp(verificationToken: string, channel: OtpChannel): Promise<OtpSent> {
    const response = await apiClient.post<ApiSuccess<OtpSent>>('/auth/otp/request', {
      verificationToken,
      channel,
    });
    return unwrap(response);
  },

  async verifyOtp(input: {
    verificationToken: string;
    channel: OtpChannel;
    code: string;
  }): Promise<AuthSession> {
    const device = await getDeviceContext();
    const response = await apiClient.post<ApiSuccess<AuthSession>>('/auth/otp/verify', {
      ...input,
      ...device,
    });
    return unwrap(response);
  },

  async providers(): Promise<{ google: boolean }> {
    const response = await apiClient.get<ApiSuccess<{ google: boolean }>>('/auth/providers');
    return unwrap(response);
  },

  // The backend URL that starts Google sign-in; opened in the browser.
  googleStartUrl(role: SignupRole, appRedirect: string): string {
    return `${env.apiBaseUrl}/auth/google/start?role=${encodeURIComponent(role)}&redirect=${encodeURIComponent(appRedirect)}`;
  },

  async googleExchange(code: string): Promise<AuthSession> {
    const device = await getDeviceContext();
    const response = await apiClient.post<ApiSuccess<AuthSession>>('/auth/google/exchange', {
      code,
      ...device,
    });
    return unwrap(response);
  },

  async getProfile(): Promise<ProfileUser> {
    const response = await apiClient.get<ApiSuccess<ProfileUser>>(
      '/auth/profile',
    );
    return unwrap(response);
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiSuccess<null>>('/auth/logout');
  },

  async logoutAllDevices(): Promise<LogoutAllResult> {
    const response = await apiClient.post<ApiSuccess<LogoutAllResult>>(
      '/auth/logout-all',
    );
    return unwrap(response);
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post<ApiSuccess<null>>('/auth/forgot-password', { email });
  },

  async resetPassword(input: {
    email: string;
    token: string;
    newPassword: string;
  }): Promise<void> {
    await apiClient.post<ApiSuccess<null>>('/auth/reset-password', input);
  },

  async uploadProfileImage(file: File | { uri: string; name: string; type: string }): Promise<ProfileUser> {
    // Field name must match the backend's `upload.single("image")` on
    // POST /auth/profile/image; any other name is rejected by multer with
    // LIMIT_UNEXPECTED_FILE (400) on every platform.
    const formData = new FormData();
    if (typeof File !== 'undefined' && file instanceof File) {
      formData.append('image', file);
    } else {
      formData.append('image', file as any);
    }

    const response = await apiClient.post<ApiSuccess<ProfileUser>>(
      '/auth/profile/image',
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

  async changePassword(input: {
    currentPassword?: string;
    newPassword?: string;
    oldPassword?: string;
  }): Promise<void> {
    await apiClient.post<ApiSuccess<null>>('/auth/change-password', input);
  },

  async deleteAccount(password: string): Promise<void> {
    await apiClient.post<ApiSuccess<null>>('/auth/delete-account', { password });
  },
};
