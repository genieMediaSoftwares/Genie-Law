import { secureStorage } from '../services/secureStorage';

interface Tokens {
  accessToken: string | null;
  refreshToken: string | null;
}

let memory: Tokens = { accessToken: null, refreshToken: null };
let sessionExpiredListener: (() => void) | null = null;

export const tokenStore = {
  async hydrate(): Promise<Tokens> {
    const [accessToken, refreshToken] = await Promise.all([
      secureStorage.getAccessToken(),
      secureStorage.getRefreshToken(),
    ]);
    memory = { accessToken, refreshToken };
    return memory;
  },

  getAccessToken: (): string | null => memory.accessToken,

  getRefreshToken: (): string | null => memory.refreshToken,

  async set(accessToken: string, refreshToken: string): Promise<void> {
    memory = { accessToken, refreshToken };
    await secureStorage.saveTokens(accessToken, refreshToken);
  },

  async clear(): Promise<void> {
    memory = { accessToken: null, refreshToken: null };
    await secureStorage.clearTokens();
  },

  onSessionExpired(listener: () => void): () => void {
    sessionExpiredListener = listener;
    return () => {
      if (sessionExpiredListener === listener) {
        sessionExpiredListener = null;
      }
    };
  },

  notifySessionExpired(): void {
    sessionExpiredListener?.();
  },
};
