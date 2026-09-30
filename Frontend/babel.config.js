module.exports = api => {
  // Under Jest, `@env` is not inlined from the developer's .env: jest.config.js
  // maps it to jest/env.js so every run sees the same, fixed test values.
  const isTest = api.env('test');

  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: isTest
      ? []
      : [
          [
            'module:react-native-dotenv',
            {
              moduleName: '@env',
              path: '.env',
              safe: false,
              allowUndefined: true,
            },
          ],
        ],
  };
};
