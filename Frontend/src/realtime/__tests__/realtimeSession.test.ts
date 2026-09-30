import { AppState } from 'react-native';
import { QueryClient } from '@tanstack/react-query';

import { startRealtimeSession, useRealtimeStatus } from '../realtimeSession';
import { useAuthStore } from '../../store/authStore';
import { tokenStore } from '../../api/tokenStore';

jest.mock('../../services/secureStorage', () =>
  require('../../test-utils/memorySecureStorage'),
);

// A stand-in for a socket.io-client Socket: tests deliver server events and
// connection changes by hand.
class MockSocket {
  handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  connected = false;
  active = true;
  connectCalls = 0;
  disconnectCalls = 0;
  constructor(public url: string, public options: Record<string, any>) {}
  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
  connect() {
    this.connectCalls += 1;
    this.active = true;
    return this;
  }
  disconnect() {
    this.disconnectCalls += 1;
    this.active = false;
    this.connected = false;
    this.fire('disconnect', 'io client disconnect');
    return this;
  }
  fire(event: string, ...args: unknown[]) {
    (this.handlers.get(event) ?? []).forEach(handler => handler(...args));
  }
  serverConnects() {
    this.connected = true;
    this.fire('connect');
  }
  listenerCount() {
    return [...this.handlers.values()].reduce((n, list) => n + list.length, 0);
  }
}

const mockSockets: MockSocket[] = [];
jest.mock('socket.io-client', () => ({
  io: (url: string, options: Record<string, unknown>) => {
    const socket = new MockSocket(url, options);
    mockSockets.push(socket);
    return socket;
  },
}));

const socketFor = (namespace: string) => {
  const socket = mockSockets.find(s => s.url.endsWith(`/${namespace}`));
  if (!socket) throw new Error(`no socket for ${namespace}`);
  return socket;
};

let appStateListener: ((state: string) => void) | null = null;
let queryClient: QueryClient;
let invalidated: unknown[][];
let stop: () => void;

const signIn = () => useAuthStore.setState({ status: 'authenticated' });
const signOut = () => useAuthStore.setState({ status: 'unauthenticated', user: null });

beforeEach(async () => {
  mockSockets.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: () => (appStateListener = null) } as ReturnType<typeof AppState.addEventListener>;
  });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  signOut();
  await tokenStore.set('access-1', 'refresh-1');
  queryClient = new QueryClient();
  invalidated = [];
  jest.spyOn(queryClient, 'invalidateQueries').mockImplementation(async filters => {
    invalidated.push((filters as { queryKey: unknown[] }).queryKey);
  });
  stop = startRealtimeSession(queryClient);
});

afterEach(() => stop());

it('opens nothing while signed out', () => {
  expect(mockSockets).toHaveLength(0);
});

it('opens one socket per namespace on the backend origin once signed in', () => {
  signIn();
  expect(mockSockets.map(s => s.url).sort()).toEqual([
    'https://api.test.invalid/cases',
    'https://api.test.invalid/chat',
    'https://api.test.invalid/notifications',
  ]);
  mockSockets.forEach(socket => expect(socket.options.transports).toEqual(['websocket']));
});

it('authenticates every (re)connect with the current access token', async () => {
  signIn();
  const auth = socketFor('notifications').options.auth as (cb: (data: object) => void) => void;
  const payloads: object[] = [];
  auth(data => payloads.push(data));
  await tokenStore.set('access-2', 'refresh-2'); // renewed by the API client
  auth(data => payloads.push(data));
  expect(payloads).toEqual([{ token: 'access-1' }, { token: 'access-2' }]);
});

it('does not open a second set of sockets when the session is re-synced', () => {
  signIn();
  useAuthStore.setState({ status: 'authenticated' });
  appStateListener?.('active');
  expect(mockSockets).toHaveLength(3);
});

describe('events', () => {
  beforeEach(() => {
    signIn();
    mockSockets.forEach(s => s.serverConnects());
    invalidated = [];
  });

  it('refreshes notifications once per notification, ignoring a redelivery', () => {
    const notification = { _id: 'n-1', title: 'Case accepted', isRead: false };
    socketFor('notifications').fire('new_notification', notification);
    socketFor('notifications').fire('new_notification', notification);
    expect(invalidated).toEqual([['notifications']]);

    socketFor('notifications').fire('new_notification', { _id: 'n-2' });
    expect(invalidated).toHaveLength(2);
  });

  it('refreshes case lists and that case, once per case version', () => {
    const update = { _id: 'case-7', status: 'accepted', updatedAt: '2026-09-30T10:00:00.000Z' };
    socketFor('cases').fire('case_updated', update);
    const first = [...invalidated];
    socketFor('cases').fire('case_updated', update);

    expect(invalidated).toEqual(first);
    expect(first).toEqual(
      expect.arrayContaining([['cases'], ['lawyer', 'leads'], ['lawyer', 'clients'], ['lawyer', 'case', 'case-7']]),
    );

    socketFor('cases').fire('case_updated', { ...update, updatedAt: '2026-09-30T10:05:00.000Z' });
    expect(invalidated.length).toBe(first.length * 2);
  });

  it('refreshes the chat list and that conversation on chat_updated', () => {
    socketFor('chat').fire('chat_updated', {
      chatId: 'chat-3',
      lastMessage: 'See you at 4',
      lastMessageAt: '2026-09-30T10:00:00.000Z',
      senderId: 'u-2',
    });
    expect(invalidated).toEqual(
      expect.arrayContaining([['chats'], ['messages', 'chat-3']]),
    );
  });

  it('marks namespaces live while connected, so screens stop polling', () => {
    expect(useRealtimeStatus.getState().live).toEqual({ notifications: true, cases: true, chat: true });
    socketFor('chat').fire('disconnect', 'transport close');
    expect(useRealtimeStatus.getState().live.chat).toBe(false);
    expect(useRealtimeStatus.getState().live.cases).toBe(true);
  });

  it('catches up after a dropped connection comes back', () => {
    socketFor('notifications').fire('disconnect', 'transport close');
    socketFor('notifications').serverConnects();
    expect(invalidated).toEqual([['notifications']]);
  });
});

it('disconnects everything and drops every listener on logout', () => {
  signIn();
  mockSockets.forEach(s => s.serverConnects());
  signOut();

  mockSockets.forEach(socket => {
    expect(socket.disconnectCalls).toBeGreaterThan(0);
    expect(socket.listenerCount()).toBe(0);
  });
  expect(useRealtimeStatus.getState().live).toEqual({ notifications: false, cases: false, chat: false });

  invalidated = [];
  mockSockets[0].fire('new_notification', { _id: 'late' });
  expect(invalidated).toEqual([]);
});

it('disconnects in the background and reconnects the same sockets in the foreground', () => {
  signIn();
  mockSockets.forEach(s => s.serverConnects());

  Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });
  appStateListener?.('background');
  mockSockets.forEach(socket => expect(socket.connected).toBe(false));

  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  appStateListener?.('active');
  expect(mockSockets).toHaveLength(3);
  mockSockets.forEach(socket => expect(socket.connectCalls).toBe(1));
});

it('retries a refused connection later instead of giving up', () => {
  jest.useFakeTimers();
  try {
    signIn();
    const socket = socketFor('cases');
    socket.active = false; // server middleware refused (e.g. expired token)
    socket.fire('connect_error', new Error('Unauthorized: invalid or expired token'));
    expect(socket.connectCalls).toBe(0);
    jest.advanceTimersByTime(5_000);
    expect(socket.connectCalls).toBe(1);
  } finally {
    jest.useRealTimers();
  }
});

it('removes its own listeners when stopped', () => {
  signIn();
  stop();
  expect(appStateListener).toBeNull();
  mockSockets.forEach(socket => expect(socket.listenerCount()).toBe(0));
  stop = () => undefined;
});
