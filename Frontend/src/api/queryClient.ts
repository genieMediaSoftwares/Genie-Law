import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

// Retried once: a failure that another attempt can plausibly fix (no
// response, timeout, 408, 5xx). Other 4xx answers — 401/403 (auth), 404, 409,
// 413, 422, and 429 (the server asked us to slow down) — would fail the same
// way again, so they are not retried.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 1) {
    return false;
  }
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === undefined || status === 408 || status >= 500;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// React Query only knows about browser tabs. On a phone, "focused" means the
// app is in the foreground: while it is in the background, refetchInterval
// polling pauses (refetchIntervalInBackground is off everywhere).
if (Platform.OS !== 'web') {
  focusManager.setEventListener(handleFocus => {
    const subscription = AppState.addEventListener('change', state => {
      handleFocus(state === 'active');
    });
    return () => subscription.remove();
  });
}
