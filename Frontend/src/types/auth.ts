export const SIGNUP_ROLES = ['client', 'lawyer'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export type UserRole = SignupRole | 'admin';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  profileImage: string;
  location: string;
  emailVerified?: boolean;
  mobileVerified?: boolean;
  authProviders?: string[];
}

export type OtpChannel = 'email' | 'mobile';

export interface OtpChannelInfo {
  destination: string;
  verified: boolean;
}

// Returned by signup, and by login for an account that still has to verify
// its email OR mobile. The token only allows requesting/entering codes.
export interface PendingVerification {
  verificationRequired: true;
  verificationToken: string;
  channels: Record<OtpChannel, OtpChannelInfo | null>;
  user: AuthUser;
}

export interface OtpSent {
  channel: OtpChannel;
  destination: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  // Only from the backend's local development delivery; never in production.
  devCode?: string;
}

export interface ProfileUser {
  _id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  profileImage: string;
  location: string;
  dob: string;
  gender: string;
  languages: string[];
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface DeviceContext {
  deviceId: string;
  deviceName: string;
  platform: string;
}

export interface LoginRequest extends DeviceContext {
  email: string;
  password: string;
}

export interface SignupRequest extends DeviceContext {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  role: SignupRole;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

export interface LogoutAllResult {
  sessionsRevoked: number;
}
