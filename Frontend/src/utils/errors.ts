import axios from 'axios';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { AuthCode } from '../types/api';
import type { ApiFailure } from '../types/api';

export interface AppErrorInfo {
  message: string;
  code?: string;
  status?: number;
  fieldErrors?: Record<string, string>;
  // The failure's `data` from the API, when it sends details.
  data?: Record<string, unknown>;
  isNetworkError: boolean;
}

// Messages are looked up when an error is shown, so they follow the language
// selected at that moment.
const GENERIC = () => i18n.t('common:errors.generic');
const OFFLINE = () => i18n.t('common:errors.offline');
const TIMEOUT = () => i18n.t('common:errors.timeout');
const UNREACHABLE = () => i18n.t('common:errors.unreachable');
const TOO_LARGE = () => i18n.t('common:errors.tooLarge');
// A browser hides the real cause of a failed upload. Sizes are checked before
// sending, so treat it as a connection problem first.
const UPLOAD_BLOCKED = () => i18n.t('common:errors.uploadBlocked');

// Backend failures with a stable `code` get a translated message; anything
// else keeps the server's own text.
const CODE_MESSAGES = {
  EMAIL_ALREADY_REGISTERED: 'common:errorCodes.EMAIL_ALREADY_REGISTERED',
  MOBILE_ALREADY_REGISTERED: 'common:errorCodes.MOBILE_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'common:errorCodes.INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'common:errorCodes.SESSION_EXPIRED',
  ACCOUNT_INACTIVE: 'common:errorCodes.ACCOUNT_INACTIVE',
  RATE_LIMITED: 'common:errorCodes.RATE_LIMITED',
  FILE_TOO_LARGE: 'common:errorCodes.FILE_TOO_LARGE',
  PAYMENTS_DISABLED: 'common:errorCodes.PAYMENTS_DISABLED',
  CONTACT_VERIFICATION_REQUIRED: 'common:errorCodes.CONTACT_VERIFICATION_REQUIRED',
  VERIFICATION_SESSION_EXPIRED: 'common:errorCodes.VERIFICATION_SESSION_EXPIRED',
  ALREADY_VERIFIED: 'common:errorCodes.ALREADY_VERIFIED',
  OTP_INVALID_CHANNEL: 'common:errorCodes.OTP_INVALID_CHANNEL',
  OTP_INVALID: 'common:errorCodes.OTP_INVALID',
  OTP_EXPIRED: 'common:errorCodes.OTP_EXPIRED',
  OTP_NOT_FOUND: 'common:errorCodes.OTP_NOT_FOUND',
  OTP_TOO_MANY_ATTEMPTS: 'common:errorCodes.OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_COOLDOWN: 'common:errorCodes.OTP_RESEND_COOLDOWN',
  OTP_RATE_LIMITED: 'common:errorCodes.OTP_RATE_LIMITED',
  GOOGLE_NOT_CONFIGURED: 'common:errorCodes.GOOGLE_NOT_CONFIGURED',
  GOOGLE_AUTH_FAILED: 'common:errorCodes.GOOGLE_AUTH_FAILED',
  OAUTH_INVALID_STATE: 'common:errorCodes.OAUTH_INVALID_STATE',
  OAUTH_INVALID_REDIRECT: 'common:errorCodes.OAUTH_INVALID_REDIRECT',
  OAUTH_INVALID_ROLE: 'common:errorCodes.OAUTH_INVALID_ROLE',
} as const;

const messageForCode = (code: string | undefined, data?: Record<string, unknown>): string | null => {
  if (!code || !(code in CODE_MESSAGES)) {
    return null;
  }
  const key = CODE_MESSAGES[code as keyof typeof CODE_MESSAGES];
  return i18n.t(key, {
    seconds: typeof data?.retryAfterSeconds === 'number' ? data.retryAfterSeconds : 60,
  });
};

const looksLikeInternals = (message: string): boolean =>
  /\b(E11000|MongoError|ValidationError|CastError|at\s+\w+\s+\(|node_modules|\/src\/|Error:\s)/i.test(
    message,
  );

const isOnlineBrowser = (): boolean =>
  Platform.OS === 'web' &&
  (globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine !== false;

const isApiFailure = (body: unknown): body is ApiFailure =>
  typeof body === 'object' &&
  body !== null &&
  'success' in body &&
  (body as { success: unknown }).success === false &&
  typeof (body as { message?: unknown }).message === 'string';

const messageForStatus = (status: number): string => {
  switch (status) {
    case 401:
      return i18n.t('common:errors.status401');
    case 403:
      return i18n.t('common:errors.status403');
    case 404:
      return i18n.t('common:errors.status404');
    case 409:
      return i18n.t('common:errors.status409');
    case 413:
      return TOO_LARGE();
    case 429:
      return i18n.t('common:errors.status429');
    case 500:
      return i18n.t('common:errors.status500');
    case 502:
    case 503:
    case 504:
      return i18n.t('common:errors.status503');
    default:
      return GENERIC();
  }
};

const fromValidationArray = (
  body: ApiFailure,
): Pick<AppErrorInfo, 'message' | 'fieldErrors'> | null => {
  if (!Array.isArray(body.errors) || body.errors.length === 0) {
    return null;
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of body.errors) {
    if (issue.path && !fieldErrors[issue.path]) {
      fieldErrors[issue.path] = issue.msg;
    }
  }

  const first = body.errors[0]?.msg;

  return {
    message: first && !looksLikeInternals(first) ? first : GENERIC(),
    fieldErrors,
  };
};

export const toAppError = (error: unknown): AppErrorInfo => {
  if (axios.isAxiosError(error)) {
    const { response, code } = error;

    if (!response) {
      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        return { message: TIMEOUT(), isNetworkError: true };
      }
      if (code === 'ERR_NETWORK') {
        if (isOnlineBrowser() && error.config?.data instanceof FormData) {
          return { message: UPLOAD_BLOCKED(), isNetworkError: true };
        }
        return { message: OFFLINE(), isNetworkError: true };
      }
      return { message: UNREACHABLE(), isNetworkError: true };
    }

    const status = response.status;
    const body = response.data;

    if (isApiFailure(body)) {
      const validation = fromValidationArray(body);
      if (validation) {
        return {
          ...validation,
          code: body.code,
          status,
          isNetworkError: false,
        };
      }

      const message =
        messageForCode(body.code, body.data) ??
        (looksLikeInternals(body.message) ? messageForStatus(status) : body.message);

      return {
        message,
        code: body.code,
        status,
        fieldErrors: body.fields,
        data: body.data,
        isNetworkError: false,
      };
    }

    return { message: messageForStatus(status), status, isNetworkError: false };
  }

  if (error instanceof Error && error.message && !looksLikeInternals(error.message)) {
    return { message: error.message, isNetworkError: false };
  }

  return { message: GENERIC(), isNetworkError: false };
};

export const isSessionEnded = (error: AppErrorInfo): boolean =>
  error.status === 401 || error.code === AuthCode.SESSION_EXPIRED;
