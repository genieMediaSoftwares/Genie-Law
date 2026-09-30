import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { authApi } from '../api/authApi';
import type { AuthSession, SignupRole } from '../types/auth';
import i18n from '../i18n';

// Google sign-in. The whole OAuth exchange (client secret, token checks,
// account lookup) happens on the backend Worker; the app only opens the
// backend's start URL and, when Google sends the browser back, swaps the
// one-time code it receives for a normal Genie Law session.

// Must match one of APP_AUTH_REDIRECT_URIS on the backend.
const NATIVE_REDIRECT = 'genielaw://auth/google';

export type GoogleOutcome =
  | { kind: 'session'; session: AuthSession }
  | { kind: 'redirecting' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

// Looked up when shown, so they follow the current language.
const FAILURE_KEYS = {
  cancelled: 'auth:google.cancelled',
  inactive: 'common:errorCodes.ACCOUNT_INACTIVE',
  failed: 'common:errorCodes.GOOGLE_AUTH_FAILED',
} as const;

const failureMessage = (reason: string): string =>
  i18n.t(FAILURE_KEYS[reason as keyof typeof FAILURE_KEYS] ?? FAILURE_KEYS.failed);

const outcomeFromParams = async (params: URLSearchParams): Promise<GoogleOutcome | null> => {
  const error = params.get('googleError');
  if (error) {
    return error === 'cancelled'
      ? { kind: 'cancelled' }
      : { kind: 'failed', message: failureMessage(error) };
  }
  const code = params.get('googleCode');
  if (!code) {
    return null;
  }
  const session = await authApi.googleExchange(code);
  return { kind: 'session', session };
};

export async function signInWithGoogle(role: SignupRole): Promise<GoogleOutcome> {
  if (Platform.OS === 'web') {
    const win = (globalThis as any).window;
    const redirect = `${win.location.origin}/`;
    win.location.assign(authApi.googleStartUrl(role, redirect));
    return { kind: 'redirecting' };
  }

  const result = await WebBrowser.openAuthSessionAsync(
    authApi.googleStartUrl(role, NATIVE_REDIRECT),
    NATIVE_REDIRECT,
  );
  if (result.type !== 'success') {
    return { kind: 'cancelled' };
  }
  const query = result.url.includes('?') ? result.url.slice(result.url.indexOf('?') + 1) : '';
  return (await outcomeFromParams(new URLSearchParams(query))) ?? {
    kind: 'failed',
    message: failureMessage('failed'),
  };
}

// Web: after Google, the backend sends the browser back to the app with
// ?googleCode= or ?googleError=. Reads it once and removes it from the URL.
export async function consumeGoogleRedirect(): Promise<GoogleOutcome | null> {
  if (Platform.OS !== 'web') {
    return null;
  }
  const win = (globalThis as any).window;
  const params = new URLSearchParams(win.location.search);
  if (!params.has('googleCode') && !params.has('googleError')) {
    return null;
  }
  win.history.replaceState(null, '', win.location.pathname);
  return outcomeFromParams(params);
}
