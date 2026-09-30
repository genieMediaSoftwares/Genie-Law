const KEY = {
  accessToken: 'genielaw.auth.accessToken',
  refreshToken: 'genielaw.auth.refreshToken',
  deviceId: 'genielaw.device.id',
} as const;

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
};

const remove = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
  }
};

export const secureStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    write(KEY.accessToken, accessToken);
    write(KEY.refreshToken, refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return read(KEY.accessToken);
  },

  async getRefreshToken(): Promise<string | null> {
    return read(KEY.refreshToken);
  },

  async clearTokens(): Promise<void> {
    remove(KEY.accessToken);
    remove(KEY.refreshToken);
  },

  async getDeviceId(): Promise<string | null> {
    return read(KEY.deviceId);
  },

  async saveDeviceId(deviceId: string): Promise<void> {
    write(KEY.deviceId, deviceId);
  },
};
