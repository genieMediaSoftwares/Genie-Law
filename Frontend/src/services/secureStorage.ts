import { NativeModules } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SERVICE = {
  accessToken: 'com.genielaw.auth.accessToken',
  refreshToken: 'com.genielaw.auth.refreshToken',
  deviceId: 'com.genielaw.device.id',
} as const;

const memoryStorage = new Map<string, string>();

const isKeychainAvailable = Boolean(NativeModules?.RNKeychainManager);

let Keychain: any = null;
if (isKeychainAvailable) {
  try {
    Keychain = require('react-native-keychain');
  } catch {
    Keychain = null;
  }
}

const write = async (service: string, value: string): Promise<void> => {
  if (isKeychainAvailable && Keychain?.setGenericPassword) {
    try {
      await Keychain.setGenericPassword(service, value, {
        service,
        accessible: Keychain.ACCESSIBLE?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      return;
    } catch {
      // Fall through to SecureStore
    }
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(service, value);
      return;
    }
  } catch {
    // Fall through to memory
  }

  memoryStorage.set(service, value);
};

const read = async (service: string): Promise<string | null> => {
  if (isKeychainAvailable && Keychain?.getGenericPassword) {
    try {
      const result = await Keychain.getGenericPassword({ service });
      if (result !== false && result?.password) {
        return result.password;
      }
    } catch {
      // Fall through to SecureStore
    }
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      return await SecureStore.getItemAsync(service);
    }
  } catch {
    // Fall through to memory
  }

  return memoryStorage.get(service) ?? null;
};

const remove = async (service: string): Promise<void> => {
  if (isKeychainAvailable && Keychain?.resetGenericPassword) {
    try {
      await Keychain.resetGenericPassword({ service });
    } catch {
      // Fall through
    }
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.deleteItemAsync(service);
    }
  } catch {
    // Fall through
  }

  memoryStorage.delete(service);
};

export const secureStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      write(SERVICE.accessToken, accessToken),
      write(SERVICE.refreshToken, refreshToken),
    ]);
  },

  getAccessToken: (): Promise<string | null> => read(SERVICE.accessToken),

  getRefreshToken: (): Promise<string | null> => read(SERVICE.refreshToken),

  async clearTokens(): Promise<void> {
    await Promise.all([
      remove(SERVICE.accessToken),
      remove(SERVICE.refreshToken),
    ]);
  },

  getDeviceId: (): Promise<string | null> => read(SERVICE.deviceId),

  saveDeviceId: (deviceId: string): Promise<void> =>
    write(SERVICE.deviceId, deviceId),
};
