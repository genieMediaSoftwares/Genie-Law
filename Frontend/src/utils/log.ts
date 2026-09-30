import axios from 'axios';

// Diagnostics that are safe to write to the device log. An Axios error carries
// its request config — the Authorization header, the request body (passwords,
// legal text) and URLs — so it is never logged as is: only the status, the
// error code, the method and the path without its query string.
export const describeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const method = (error.config?.method ?? '').toUpperCase();
    const path = (error.config?.url ?? '').split('?')[0];
    const status = error.response?.status ?? 'no response';
    return `${method} ${path} → ${status}${error.code ? ` (${error.code})` : ''}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return typeof error === 'string' ? error : 'unknown error';
};

export const logError = (context: string, error: unknown): void => {
  console.warn(`[${context}] ${describeError(error)}`);
};
