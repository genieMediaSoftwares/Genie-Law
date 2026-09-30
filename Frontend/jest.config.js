// Unit, component and integration tests (Jest + React Native Testing Library).
// Native modules have no implementation under Jest; jest/setup.ts replaces
// them with in-memory stand-ins. Nothing here talks to a real backend.
module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^@env$': '<rootDir>/jest/env.js',
    '\\.css$': '<rootDir>/jest/styleMock.js',
  },
  setupFiles: ['<rootDir>/jest/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest/setupAfterEnv.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[a-z-]+)?|@react-native(-community)?|@react-native-async-storage|@react-native-documents|@react-navigation|@bam\\.tech|expo(-[a-z-]+)?|@expo|nativewind|react-native-css-interop|socket\\.io-client|engine\\.io-client|test-renderer)/)',
  ],
  clearMocks: true,
  restoreMocks: true,
};
