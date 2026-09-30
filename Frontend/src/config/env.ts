import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  AI_UPLOAD_MAX_MB,
  AI_OPTIMIZE_MAX_MB,
} from '@env';
import { version as packageVersion } from '../../package.json';

const stripTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

// The backend address is used exactly as written in .env (API_BASE_URL); the
// app never guesses or rewrites the host. Examples:
//   web on the laptop            http://localhost:5000/api
//   phone / emulator on Wi-Fi    http://<laptop Wi-Fi IP>:5000/api
//   phone over USB (adb reverse) http://localhost:5000/api
//   production                   https://<api-domain>/api
const readBaseUrl = (): string => {
  const configured = readRequired('API_BASE_URL', API_BASE_URL);
  if (!/^https?:\/\/[^/]+/i.test(configured)) {
    throw new Error('API_BASE_URL must be a full http(s) URL ending in /api, e.g. https://<api-domain>/api.');
  }
  return stripTrailingSlash(configured);
};

// Every setting comes from .env; there are no built-in fallbacks. A missing or
// invalid value stops the app with a message naming it.
const missing = (name: string): Error =>
  new Error(`${name} is not set. Set it in .env, then restart Metro with --reset-cache.`);

const readRequired = (name: string, value: string | undefined): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw missing(name);
  }
  return trimmed;
};

const readPositiveNumber = (name: string, value: string | undefined): number => {
  const parsed = Number(readRequired(name, value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
};

const apiBaseUrl = readBaseUrl();

export const env = {
  apiBaseUrl,
  // scheme://host[:port] of the backend. Realtime connects here, and only
  // requests to this origin may carry the user's token.
  apiOrigin: /^https?:\/\/[^/]+/i.exec(apiBaseUrl)![0],
  apiTimeoutMs: readPositiveNumber('API_TIMEOUT_MS', API_TIMEOUT_MS),
  supportEmail: readRequired('SUPPORT_EMAIL', SUPPORT_EMAIL),
  supportPhone: readRequired('SUPPORT_PHONE', SUPPORT_PHONE),
  // AI Smart Case Assistant: largest document accepted after optimization, and
  // largest original the server will receive to optimize.
  aiUploadMaxMb: readPositiveNumber('AI_UPLOAD_MAX_MB', AI_UPLOAD_MAX_MB),
  aiOptimizeMaxMb: readPositiveNumber('AI_OPTIMIZE_MAX_MB', AI_OPTIMIZE_MAX_MB),
  appVersion: packageVersion,
};
