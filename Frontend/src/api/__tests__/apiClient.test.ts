import {
  authHeaderOf,
  requests,
  resetHttpStub,
  setHttpHandler,
} from '../../test-utils/httpStub';
import { resetSecureStorage, storedTokens } from '../../test-utils/memorySecureStorage';
import { apiClient, isApiUrl } from '../apiClient';
import { tokenStore } from '../tokenStore';
import { queryClient } from '../queryClient';
import { toAppError } from '../../utils/errors';

jest.mock('../../services/secureStorage', () =>
  require('../../test-utils/memorySecureStorage'),
);

const REFRESH = '/auth/refresh-token';

const renewed = (n: number) => ({
  status: 200,
  data: { success: true, message: 'ok', data: { token: `access-${n}`, refreshToken: `refresh-${n}` } },
});

let sessionExpired: jest.Mock;
let unbind: () => void;

beforeEach(async () => {
  resetHttpStub();
  resetSecureStorage();
  await tokenStore.set('access-0', 'refresh-0');
  sessionExpired = jest.fn();
  unbind = tokenStore.onSessionExpired(sessionExpired);
});

afterEach(() => unbind());

describe('configuration', () => {
  it('uses the configured base URL and timeout', () => {
    expect(apiClient.defaults.baseURL).toBe('https://api.test.invalid/api');
    expect(apiClient.defaults.timeout).toBe(20000);
  });

  it('treats relative paths and the backend origin as API URLs only', () => {
    expect(isApiUrl('/cases')).toBe(true);
    expect(isApiUrl('https://api.test.invalid/uploads/a.pdf')).toBe(true);
    expect(isApiUrl('https://api.test.invalid.evil.example/x')).toBe(false);
    expect(isApiUrl('https://files.example.com/a.pdf')).toBe(false);
  });

  it('sends the token to the backend but never to another host', async () => {
    setHttpHandler(() => ({ status: 200, data: {} }));
    await apiClient.get('/cases');
    await apiClient.get('https://files.example.com/a.pdf');
    expect(authHeaderOf(requests[0])).toBe('Bearer access-0');
    expect(authHeaderOf(requests[1])).toBeUndefined();
  });
});

describe('401 and token refresh', () => {
  it('refreshes once and retries the request with the new token', async () => {
    setHttpHandler(config => {
      if (config.url === REFRESH) return renewed(1);
      return authHeaderOf(config) === 'Bearer access-1'
        ? { status: 200, data: { ok: true } }
        : { status: 401, data: { success: false, message: 'expired' } };
    });

    const response = await apiClient.get('/cases');

    expect(response.data).toEqual({ ok: true });
    expect(requests.filter(r => r.url === REFRESH)).toHaveLength(1);
    expect(JSON.parse(requests.find(r => r.url === REFRESH)!.data)).toEqual({
      refreshToken: 'refresh-0',
    });
    expect(storedTokens()).toEqual({ access: 'access-1', refresh: 'refresh-1' });
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent 401s (single flight)', async () => {
    let refreshCalls = 0;
    setHttpHandler(async config => {
      if (config.url === REFRESH) {
        refreshCalls += 1;
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        return renewed(refreshCalls);
      }
      return authHeaderOf(config) === 'Bearer access-1'
        ? { status: 200, data: config.url }
        : { status: 401 };
    });

    const results = await Promise.all([
      apiClient.get('/a'),
      apiClient.get('/b'),
      apiClient.get('/c'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results.map(r => r.data)).toEqual(['/a', '/b', '/c']);
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('retries with an already renewed token instead of refreshing again', async () => {
    setHttpHandler(async config => {
      if (config.url === REFRESH) return renewed(9);
      if (authHeaderOf(config) === 'Bearer access-0') {
        // Another request renewed the session while this one was in flight.
        await tokenStore.set('access-1', 'refresh-1');
        return { status: 401 };
      }
      return { status: 200, data: 'fresh' };
    });

    const response = await apiClient.get('/cases');

    expect(response.data).toBe('fresh');
    expect(requests.filter(r => r.url === REFRESH)).toHaveLength(0);
    expect(authHeaderOf(requests[1])).toBe('Bearer access-1');
  });

  it('ends the session when the backend refuses the refresh token', async () => {
    setHttpHandler(config =>
      config.url === REFRESH
        ? { status: 401, data: { success: false, message: 'revoked' } }
        : { status: 401 },
    );

    await expect(apiClient.get('/cases')).rejects.toMatchObject({ response: { status: 401 } });

    expect(storedTokens()).toEqual({ access: null, refresh: null });
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(sessionExpired).toHaveBeenCalled();
  });

  it('keeps the session when the refresh cannot reach the backend', async () => {
    setHttpHandler(config =>
      config.url === REFRESH ? { networkError: 'ERR_NETWORK' } : { status: 401 },
    );

    const error = await apiClient.get('/cases').catch(e => e);

    expect(error.response).toBeUndefined();
    expect(toAppError(error).isNetworkError).toBe(true);
    expect(storedTokens()).toEqual({ access: 'access-0', refresh: 'refresh-0' });
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh endpoint is overloaded (503/429)', async () => {
    for (const status of [503, 429]) {
      setHttpHandler(config => (config.url === REFRESH ? { status } : { status: 401 }));
      await expect(apiClient.get('/cases')).rejects.toMatchObject({ response: { status } });
      expect(storedTokens().refresh).toBe('refresh-0');
    }
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('never loops: a second 401 after the retry ends the session', async () => {
    let refreshCalls = 0;
    setHttpHandler(config => {
      if (config.url === REFRESH) {
        refreshCalls += 1;
        return renewed(refreshCalls);
      }
      return { status: 401 };
    });

    await expect(apiClient.get('/cases')).rejects.toMatchObject({ response: { status: 401 } });

    expect(refreshCalls).toBe(1);
    expect(requests.filter(r => r.url === '/cases')).toHaveLength(2);
    expect(sessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for the login endpoint', async () => {
    setHttpHandler(() => ({
      status: 401,
      data: { success: false, message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
    }));

    await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy();

    expect(requests.map(r => r.url)).toEqual(['/auth/login']);
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('ends the session without a network call when no refresh token is stored', async () => {
    await tokenStore.clear();
    setHttpHandler(() => ({ status: 401 }));

    await expect(apiClient.get('/cases')).rejects.toBeTruthy();

    expect(requests.map(r => r.url)).toEqual(['/cases']);
    expect(sessionExpired).toHaveBeenCalled();
  });
});

describe('failures other than 401', () => {
  it('reports a timeout as a network error with a timeout message', async () => {
    setHttpHandler(() => ({ networkError: 'ECONNABORTED' }));
    const info = toAppError(await apiClient.get('/cases').catch(e => e));
    expect(info.isNetworkError).toBe(true);
    expect(info.message).toMatch(/too long|timed out/i);
  });

  it('reports no connection as offline', async () => {
    setHttpHandler(() => ({ networkError: 'ERR_NETWORK' }));
    const info = toAppError(await apiClient.get('/cases').catch(e => e));
    expect(info.isNetworkError).toBe(true);
    expect(info.status).toBeUndefined();
  });

  it('passes 429 through untouched, with a rate-limit message', async () => {
    setHttpHandler(() => ({ status: 429, data: { success: false, message: 'Slow down', code: 'RATE_LIMITED' } }));
    const error = await apiClient.get('/cases').catch(e => e);
    const info = toAppError(error);
    expect(info.status).toBe(429);
    expect(info.code).toBe('RATE_LIMITED');
    expect(requests.filter(r => r.url === REFRESH)).toHaveLength(0);
  });
});

describe('query retry policy', () => {
  const retry = queryClient.getDefaultOptions().queries!.retry as (
    count: number,
    error: unknown,
  ) => boolean;
  const withStatus = (status?: number) => (status ? { response: { status } } : new Error('offline'));

  it('retries once for failures another attempt can fix', () => {
    expect(retry(0, withStatus())).toBe(true);
    expect(retry(0, withStatus(503))).toBe(true);
    expect(retry(0, withStatus(408))).toBe(true);
    expect(retry(1, withStatus(503))).toBe(false);
  });

  it('never retries answers that would fail the same way', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429]) {
      expect(retry(0, withStatus(status))).toBe(false);
    }
  });
});
