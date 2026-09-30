import { Platform } from 'react-native';

import { secureStorage } from './secureStorage';
import type { DeviceContext } from '../types/auth';

const randomHex = (bytes: number): string => {
  let out = '';
  for (let i = 0; i < bytes; i += 1) {
    out += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
};

const generateDeviceId = (): string =>
  `${Platform.OS}-${Date.now().toString(36)}-${randomHex(16)}`;

let cached: string | null = null;

export const getDeviceId = async (): Promise<string> => {
  if (cached) {
    return cached;
  }

  const stored = await secureStorage.getDeviceId();
  if (stored) {
    cached = stored;
    return stored;
  }

  const created = generateDeviceId();
  await secureStorage.saveDeviceId(created);
  cached = created;
  return created;
};

export const getDeviceContext = async (): Promise<DeviceContext> => ({
  deviceId: await getDeviceId(),
  deviceName: `${Platform.OS} ${String(Platform.Version)}`,
  platform: Platform.OS,
});
