// Test-only in-memory replacement for src/services/secureStorage (Keychain /
// Keystore do not exist under Jest). Use with:
//   jest.mock('<path>/services/secureStorage', () => require('<path>/test-utils/memorySecureStorage'));
const values = new Map<string, string>();

export const secureStorage = {
  saveTokens: jest.fn(async (accessToken: string, refreshToken: string) => {
    values.set('access', accessToken);
    values.set('refresh', refreshToken);
  }),
  getAccessToken: jest.fn(async () => values.get('access') ?? null),
  getRefreshToken: jest.fn(async () => values.get('refresh') ?? null),
  clearTokens: jest.fn(async () => {
    values.delete('access');
    values.delete('refresh');
  }),
  getDeviceId: jest.fn(async () => values.get('device') ?? null),
  saveDeviceId: jest.fn(async (id: string) => {
    values.set('device', id);
  }),
};

export const storedTokens = () => ({
  access: values.get('access') ?? null,
  refresh: values.get('refresh') ?? null,
});

export const resetSecureStorage = (): void => {
  values.clear();
};
