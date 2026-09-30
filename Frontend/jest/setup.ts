/* eslint-env jest */
// Stand-ins for native modules, which have no implementation under Jest.
// These replace the device, never the backend: no test data lives here.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-worklets', () => ({}), { virtual: true });

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    isAvailableAsync: jest.fn(async () => true),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('react-native-keychain', () => ({}));

jest.mock('expo-audio', () => ({
  AudioModule: { AudioRecorder: jest.fn() },
  IOSOutputFormat: { MPEG4AAC: 'aac ' },
  AudioQuality: { HIGH: 96 },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system', () => ({
  Directory: jest.fn(),
  File: Object.assign(jest.fn(), { downloadFileAsync: jest.fn() }),
  Paths: { cache: 'file:///cache/' },
}));

jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('@react-native-documents/picker', () => ({}));
jest.mock('@bam.tech/react-native-image-resizer', () => ({
  createResizedImage: jest.fn(),
}));
