export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiValidationIssue {
  type: string;
  value?: unknown;
  msg: string;
  path: string;
  location: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  code?: string;
  fields?: Record<string, string>;
  errors?: ApiValidationIssue[];
  // Extra details for some failures (e.g. retryAfterSeconds).
  data?: Record<string, unknown>;
}

export const AuthCode = {
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  MOBILE_ALREADY_REGISTERED: 'MOBILE_ALREADY_REGISTERED',
  NAME_ALREADY_IN_USE: 'NAME_ALREADY_IN_USE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACTIVE_SESSION_EXISTS: 'ACTIVE_SESSION_EXISTS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type AuthCodeValue = (typeof AuthCode)[keyof typeof AuthCode];
