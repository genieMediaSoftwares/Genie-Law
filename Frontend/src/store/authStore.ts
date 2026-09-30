import { create } from 'zustand';

import { authApi } from '../api/authApi';
import { tokenStore } from '../api/tokenStore';
import { queryClient } from '../api/queryClient';
import { toAppError } from '../utils/errors';
import { caseDraftFiles } from '../services/caseDraftFiles';
import { clearOpenedDocuments } from '../services/documentOpener';
import type { AuthSession, AuthUser, PendingVerification, SignupRole } from '../types/auth';

export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;

  restore: () => Promise<void>;

  login: (email: string, password: string) => Promise<void>;

  signup: (input: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    role: SignupRole;
  }) => Promise<PendingVerification>;

  // Stores a session from any sign-in path (OTP verification, Google).
  completeSession: (session: AuthSession) => Promise<void>;

  logout: () => Promise<void>;

  handleSessionExpired: () => void;
}

// Everything the signed-in user left on the device besides the tokens: cached
// server data, downloaded document copies and unsent case drafts.
const clearUserData = (): void => {
  queryClient.clear();
  clearOpenedDocuments();
  caseDraftFiles.clear();
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'restoring',
  user: null,

  async restore() {
    const { accessToken, refreshToken } = await tokenStore.hydrate();

    if (!accessToken && !refreshToken) {
      set({ status: 'unauthenticated', user: null });
      return;
    }

    try {
      const profile = await authApi.getProfile();

      set({
        status: 'authenticated',
        user: {
          id: profile._id,
          fullName: profile.fullName,
          email: profile.email,
          mobile: profile.mobile,
          role: profile.role,
          profileImage: profile.profileImage,
          location: profile.location,
        },
      });
    } catch (error) {
      const info = toAppError(error);

      if (!info.isNetworkError) {
        await tokenStore.clear();
      }

      set({ status: 'unauthenticated', user: null });
    }
  },

  async login(email, password) {
    const session = await authApi.login({ email, password });

    await tokenStore.set(session.token, session.refreshToken);
    set({ status: 'authenticated', user: session.user });
  },

  // A new account is not signed in until its email or mobile is verified.
  async signup(input) {
    return authApi.signup(input);
  },

  async completeSession(session) {
    await tokenStore.set(session.token, session.refreshToken);
    set({ status: 'authenticated', user: session.user });
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
    } finally {
      await tokenStore.clear();
      clearUserData();
      set({ status: 'unauthenticated', user: null });
    }
  },

  handleSessionExpired() {
    clearUserData();
    if (get().status !== 'unauthenticated') {
      set({ status: 'unauthenticated', user: null });
    }
  },
}));

export const bindSessionExpiryHandler = (): (() => void) =>
  tokenStore.onSessionExpired(() => {
    useAuthStore.getState().handleSessionExpired();
  });
