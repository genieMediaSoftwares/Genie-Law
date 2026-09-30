import { requests, resetHttpStub, setHttpHandler } from '../../test-utils/httpStub';
import { resetSecureStorage, storedTokens } from '../../test-utils/memorySecureStorage';
import { bindSessionExpiryHandler, useAuthStore } from '../authStore';
import { tokenStore } from '../../api/tokenStore';
import { queryClient } from '../../api/queryClient';
import { clearOpenedDocuments } from '../../services/documentOpener';
import { caseDraftFiles } from '../../services/caseDraftFiles';
import type { AuthSession } from '../../types/auth';

jest.mock('../../services/secureStorage', () =>
  require('../../test-utils/memorySecureStorage'),
);
jest.mock('../../services/documentOpener', () => ({
  clearOpenedDocuments: jest.fn(),
}));

// Shapes as returned by backend/src/controllers/auth (publicUser / raw profile).
const session: AuthSession = {
  token: 'jwt-access-1',
  refreshToken: 'refresh-1',
  expiresIn: 604800,
  user: {
    id: '6650f0c2a1b2c3d4e5f60718',
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    mobile: '9876543210',
    role: 'client',
    profileImage: '',
    location: '',
  },
};

const ok = (data: unknown) => ({ status: 200, data: { success: true, message: 'ok', data } });

beforeEach(async () => {
  resetHttpStub();
  resetSecureStorage();
  await tokenStore.clear();
  queryClient.clear();
  useAuthStore.setState({ status: 'unauthenticated', user: null });
});

describe('login', () => {
  it('stores the tokens securely and signs in on success', async () => {
    setHttpHandler(config =>
      config.url === '/auth/login' ? ok(session) : { status: 404 },
    );

    await useAuthStore.getState().login('asha@example.com', 'secret-pass');

    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user: session.user });
    expect(storedTokens()).toEqual({ access: 'jwt-access-1', refresh: 'refresh-1' });
    const body = JSON.parse(requests[0].data);
    expect(body).toMatchObject({ email: 'asha@example.com', password: 'secret-pass' });
    expect(body.deviceId).toEqual(expect.any(String));
  });

  it('stays signed out and surfaces the backend error on failure', async () => {
    setHttpHandler(() => ({
      status: 401,
      data: { success: false, message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
    }));

    await expect(
      useAuthStore.getState().login('asha@example.com', 'wrong'),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(storedTokens()).toEqual({ access: null, refresh: null });
  });
});

describe('logout', () => {
  beforeEach(async () => {
    await useAuthStore.getState().completeSession(session);
    queryClient.setQueryData(['cases'], [{ _id: 'c1' }]);
    caseDraftFiles.stash('session-1', [{ uri: 'file:///a.pdf', name: 'a.pdf', type: 'application/pdf', size: 1 }]);
  });

  it('ends the backend session and clears everything left on the device', async () => {
    setHttpHandler(config => (config.url === '/auth/logout' ? ok(null) : { status: 404 }));

    await useAuthStore.getState().logout();

    expect(requests.map(r => r.url)).toEqual(['/auth/logout']);
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(storedTokens()).toEqual({ access: null, refresh: null });
    expect(queryClient.getQueryData(['cases'])).toBeUndefined();
    expect(clearOpenedDocuments).toHaveBeenCalled();
    expect(caseDraftFiles.take('session-1')).toEqual([]);
  });

  it('still signs out locally when the backend cannot be reached', async () => {
    setHttpHandler(() => ({ networkError: 'ERR_NETWORK' }));

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(storedTokens()).toEqual({ access: null, refresh: null });
  });
});

describe('restore on launch', () => {
  it('signs in with stored tokens verified by /auth/profile', async () => {
    await tokenStore.set('jwt-access-1', 'refresh-1');
    setHttpHandler(() =>
      ok({ ...session.user, id: undefined, _id: session.user.id, dob: '', gender: '', languages: [] }),
    );

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.id).toBe(session.user.id);
  });

  it('keeps the tokens when offline, so the next launch can still restore', async () => {
    await tokenStore.set('jwt-access-1', 'refresh-1');
    setHttpHandler(() => ({ networkError: 'ERR_NETWORK' }));

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(storedTokens()).toEqual({ access: 'jwt-access-1', refresh: 'refresh-1' });
  });

  it('clears the tokens when the backend rejects the session', async () => {
    await tokenStore.set('jwt-access-1', 'refresh-1');
    setHttpHandler(() => ({ status: 403, data: { success: false, message: 'Account inactive', code: 'ACCOUNT_INACTIVE' } }));

    await useAuthStore.getState().restore();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(storedTokens()).toEqual({ access: null, refresh: null });
  });
});

describe('session expiry', () => {
  it('signs out and clears cached data when the API client ends the session', async () => {
    const unbind = bindSessionExpiryHandler();
    await useAuthStore.getState().completeSession(session);
    queryClient.setQueryData(['notifications'], ['n1']);

    tokenStore.notifySessionExpired();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
    unbind();
  });
});
