import axios from 'axios';
import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

import { env } from '../config/env';
import { tokenStore } from './tokenStore';
import { toAppError } from '../utils/errors';
import type { ApiSuccess } from '../types/api';
import type { AuthSession } from '../types/auth';

const REFRESH_EXEMPT = [
  '/auth/refresh-token',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
];

interface RetryableConfig extends InternalAxiosRequestConfig {
  _genieRetry?: boolean;
}

// File uploads can take far longer than the JSON default (API_TIMEOUT_MS): a
// multi-MB file on a slow mobile uplink needs well over 20s, so uploads that
// finish instantly on laptop Wi-Fi were timing out on phones.
export const UPLOAD_TIMEOUT_MS = 120_000;

// True for a relative path (resolved against API_BASE_URL) or an absolute URL
// on the backend's own origin. The token is never sent anywhere else.
export const isApiUrl = (url: string): boolean =>
  !/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith(`${env.apiOrigin}/`);

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(config => {
  const token = tokenStore.getAccessToken();
  if (token && isApiUrl(config.url ?? '')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

// `rejected`: the backend refused the refresh token, so the session is over.
// `unavailable`: the backend could not be asked (offline, timeout, 5xx, 429);
// the session may still be valid, so the tokens are kept for the next try.
type RefreshOutcome =
  | { kind: 'renewed'; token: string }
  | { kind: 'rejected' }
  | { kind: 'unavailable'; error: unknown };

const isTransientFailure = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || !error.response) {
    return true;
  }
  const status = error.response.status;
  return status >= 500 || status === 408 || status === 429;
};

let refreshInFlight: Promise<RefreshOutcome> | null = null;

const performRefresh = async (): Promise<RefreshOutcome> => {
  const refreshToken = tokenStore.getRefreshToken();

  if (!refreshToken) {
    return { kind: 'rejected' };
  }

  try {
    const response = await refreshClient.post<ApiSuccess<AuthSession>>(
      '/auth/refresh-token',
      { refreshToken },
    );

    const session = response.data?.data;

    if (!session?.token || !session?.refreshToken) {
      return { kind: 'rejected' };
    }

    await tokenStore.set(session.token, session.refreshToken);
    return { kind: 'renewed', token: session.token };
  } catch (error) {
    return isTransientFailure(error)
      ? { kind: 'unavailable', error }
      : { kind: 'rejected' };
  }
};

// Single flight: the backend rotates the refresh token on every use, so a
// second concurrent refresh would spend a token the first already replaced.
const refreshAccessToken = (): Promise<RefreshOutcome> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

const endSession = async (): Promise<void> => {
  await tokenStore.clear();
  tokenStore.notifySessionExpired();
};

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !config) {
      return Promise.reject(error);
    }

    const url = config.url ?? '';
    if (REFRESH_EXEMPT.some(path => url.includes(path)) || !isApiUrl(url)) {
      return Promise.reject(error);
    }

    if (config._genieRetry) {
      await endSession();
      return Promise.reject(error);
    }

    if (!tokenStore.getRefreshToken()) {
      await endSession();
      return Promise.reject(error);
    }

    // A request sent with a token that another request has since renewed is
    // simply retried with the current one, instead of refreshing again.
    const current = tokenStore.getAccessToken();
    const sentWith = String(config.headers.get('Authorization') ?? '');
    const outcome: RefreshOutcome =
      current && sentWith !== `Bearer ${current}`
        ? { kind: 'renewed', token: current }
        : await refreshAccessToken();

    if (outcome.kind === 'unavailable') {
      return Promise.reject(outcome.error);
    }

    if (outcome.kind === 'rejected') {
      await endSession();
      return Promise.reject(error);
    }

    config._genieRetry = true;
    config.headers.set('Authorization', `Bearer ${outcome.token}`);

    return apiClient(config);
  },
);

// Last in the chain: a failed request's `message` becomes the sentence the user
// should read (translated; never "Request failed with status code 500"), since
// screens show `query.error.message` directly. Status and code are untouched,
// so toAppError() still classifies the error the same way.
apiClient.interceptors.response.use(
  response => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      error.message = toAppError(error).message;
    }
    return Promise.reject(error);
  },
);

export const unwrap = <T>(response: { data: ApiSuccess<T> }): T =>
  response.data.data;
