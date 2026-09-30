// `@env` under Jest (see babel.config.js). Test-only values; the backend is
// never contacted — every test replaces the network layer.
module.exports = {
  API_BASE_URL: 'https://api.test.invalid/api',
  API_TIMEOUT_MS: '20000',
  SUPPORT_EMAIL: 'support@test.invalid',
  SUPPORT_PHONE: '+910000000000',
  AI_UPLOAD_MAX_MB: '10',
  AI_OPTIMIZE_MAX_MB: '10',
};
