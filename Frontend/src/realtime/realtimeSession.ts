import { AppState, Platform } from 'react-native';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { create } from 'zustand';

import { env } from '../config/env';
import { tokenStore } from '../api/tokenStore';
import { useAuthStore } from '../store/authStore';

// Live updates for the signed-in user.
//
// The backend pushes changes on three authenticated Socket.IO namespaces
// (backend/src/realtime/events.js); each socket joins a room named after the
// user, so only that user's events arrive:
//   /notifications  new_notification
//   /cases          case_updated
//   /chat           chat_created, chat_updated, chat_read
// An event never writes data into the cache: it marks the matching queries
// stale, and React Query refetches what is on screen from the backend. A
// repeated event therefore cannot duplicate anything; it is also dropped
// before refetching (see `seen`).
//
// While a namespace is connected its screens stop polling (useRealtimeLive);
// while it is down, they fall back to their existing interval so nothing goes
// stale. All namespaces share one WebSocket (socket.io multiplexing).

export type RealtimeNamespace = 'notifications' | 'cases' | 'chat';

const NAMESPACES: RealtimeNamespace[] = ['notifications', 'cases', 'chat'];

interface RealtimeStatus {
  live: Record<RealtimeNamespace, boolean>;
}

const OFFLINE: RealtimeStatus['live'] = { notifications: false, cases: false, chat: false };

export const useRealtimeStatus = create<RealtimeStatus>(() => ({ live: OFFLINE }));

// True while pushes for `namespace` are arriving, i.e. polling is unnecessary.
export const useRealtimeLive = (namespace: RealtimeNamespace): boolean =>
  useRealtimeStatus(state => state.live[namespace]);

const setLive = (namespace: RealtimeNamespace, value: boolean) => {
  useRealtimeStatus.setState(state =>
    state.live[namespace] === value ? state : { live: { ...state.live, [namespace]: value } },
  );
};

// Remembers recent event keys so a redelivered event is ignored. Bounded: the
// oldest keys are forgotten first.
const SEEN_LIMIT = 200;
const createSeen = () => {
  const keys = new Set<string>();
  return (key: string | null): boolean => {
    if (!key) {
      return false;
    }
    if (keys.has(key)) {
      return true;
    }
    keys.add(key);
    if (keys.size > SEEN_LIMIT) {
      keys.delete(keys.values().next().value as string);
    }
    return false;
  };
};

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value) {
    return value;
  }
  if (value && typeof value === 'object' && '_id' in value) {
    return idOf((value as { _id: unknown })._id);
  }
  return null;
};

const field = (payload: unknown, name: string): unknown =>
  payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[name] : undefined;

// The queries each event makes stale.
export const queriesFor = {
  notification: (): QueryKey[] => [['notifications']],
  caseUpdated: (caseId: string | null): QueryKey[] => [
    ['cases'],
    ['lawyer', 'leads'],
    ['lawyer', 'clients'],
    ['lawyer', 'hearings'],
    ['lawyer', 'schedule'],
    ...(caseId
      ? [['lawyer', 'lead', caseId], ['lawyer', 'case', caseId]]
      : [['lawyer', 'lead'], ['lawyer', 'case']]),
    ['lawyer', 'client'],
  ],
  chat: (chatId: string | null): QueryKey[] => [
    ['chats'],
    ['lawyer', 'messages', 'unread'],
    ...(chatId ? [['messages', chatId]] : []),
  ],
};

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

// Starts following the auth state for the app's lifetime: connected while
// signed in and in the foreground, disconnected otherwise. Returns a stop
// function that disconnects everything and removes every listener.
export function startRealtimeSession(queryClient: QueryClient): () => void {
  let sockets: Socket[] = [];
  const retryTimers = new Map<Socket, ReturnType<typeof setTimeout>>();
  const seen = createSeen();

  const invalidate = (keys: QueryKey[]) => {
    keys.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey });
    });
  };

  const handlers: Record<RealtimeNamespace, (socket: Socket) => void> = {
    notifications: socket => {
      socket.on('new_notification', (notification: unknown) => {
        const notificationId = idOf(notification);
        if (notificationId && seen(`notification:${notificationId}`)) {
          return;
        }
        invalidate(queriesFor.notification());
      });
    },
    cases: socket => {
      socket.on('case_updated', (caseItem: unknown) => {
        const caseId = idOf(caseItem);
        const version = field(caseItem, 'updatedAt');
        if (caseId && version && seen(`case:${caseId}:${String(version)}`)) {
          return;
        }
        invalidate(queriesFor.caseUpdated(caseId));
      });
    },
    chat: socket => {
      const onChat = (event: string) => (payload: unknown) => {
        const chatId = idOf(field(payload, 'chatId'));
        const at = field(payload, 'lastMessageAt');
        if (chatId && at && seen(`${event}:${chatId}:${String(at)}`)) {
          return;
        }
        invalidate(queriesFor.chat(chatId));
      };
      socket.on('chat_created', onChat('chat_created'));
      socket.on('chat_updated', onChat('chat_updated'));
      socket.on('chat_read', onChat('chat_read'));
    },
  };

  const clearRetry = (socket: Socket) => {
    const timer = retryTimers.get(socket);
    if (timer) {
      clearTimeout(timer);
      retryTimers.delete(socket);
    }
  };

  const open = () => {
    if (sockets.length > 0) {
      sockets.forEach(socket => {
        if (!socket.connected && !socket.active) {
          socket.connect();
        }
      });
      return;
    }
    sockets = NAMESPACES.map(namespace => {
      const socket = io(`${env.apiOrigin}/${namespace}`, {
        transports: ['websocket'],
        // Read at every (re)connect, so a token renewed by the API client is used.
        auth: callback => callback({ token: tokenStore.getAccessToken() ?? '' }),
      });
      let connectedBefore = false;
      let retryDelay = RETRY_MIN_MS;

      socket.on('connect', () => {
        clearRetry(socket);
        retryDelay = RETRY_MIN_MS;
        setLive(namespace, true);
        if (connectedBefore) {
          // Back after a gap: events sent meanwhile were missed.
          invalidate(
            namespace === 'notifications'
              ? queriesFor.notification()
              : namespace === 'cases'
              ? queriesFor.caseUpdated(null)
              : queriesFor.chat(null),
          );
        }
        connectedBefore = true;
      });

      socket.on('disconnect', () => setLive(namespace, false));

      socket.on('connect_error', () => {
        setLive(namespace, false);
        // socket.io retries transport failures itself. A refusal by the
        // server (expired token) is final for that attempt, so retry later
        // with a fresh token; polling covers the gap meanwhile.
        if (!socket.active && !retryTimers.has(socket)) {
          retryTimers.set(
            socket,
            setTimeout(() => {
              retryTimers.delete(socket);
              if (useAuthStore.getState().status === 'authenticated') {
                socket.connect();
              }
            }, retryDelay),
          );
          retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
        }
      });

      handlers[namespace](socket);
      return socket;
    });
  };

  const close = () => {
    sockets.forEach(socket => {
      clearRetry(socket);
      socket.removeAllListeners();
      socket.disconnect();
    });
    sockets = [];
    useRealtimeStatus.setState({ live: OFFLINE });
  };

  const pause = () => {
    sockets.forEach(socket => {
      clearRetry(socket);
      socket.disconnect();
    });
  };

  const sync = () => {
    const signedIn = useAuthStore.getState().status === 'authenticated';
    const foreground = Platform.OS === 'web' || AppState.currentState !== 'background';
    if (!signedIn) {
      close();
    } else if (foreground) {
      open();
    } else {
      pause();
    }
  };

  const unsubscribeAuth = useAuthStore.subscribe((state, previous) => {
    if (state.status !== previous.status) {
      sync();
    }
  });
  const appState =
    Platform.OS === 'web' ? null : AppState.addEventListener('change', sync);

  sync();

  return () => {
    unsubscribeAuth();
    appState?.remove();
    close();
  };
}
