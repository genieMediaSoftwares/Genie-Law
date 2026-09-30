// Test-only stand-in for socket.io-client, for screens wired to the realtime
// session. Use with:
//   jest.mock('socket.io-client', () => require('<path>/test-utils/fakeSocketIo'));
type Handler = (...args: unknown[]) => void;

export class FakeSocket {
  handlers = new Map<string, Handler[]>();
  connected = false;
  active = true;
  constructor(public url: string, public options: Record<string, unknown>) {}
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
  connect() {
    this.active = true;
    return this;
  }
  disconnect() {
    this.active = false;
    this.connected = false;
    this.fire('disconnect');
    return this;
  }
  fire(event: string, ...args: unknown[]) {
    (this.handlers.get(event) ?? []).forEach(handler => handler(...args));
  }
  serverConnects() {
    this.connected = true;
    this.fire('connect');
  }
}

export const fakeSockets: FakeSocket[] = [];

export const io = (url: string, options: Record<string, unknown>) => {
  const socket = new FakeSocket(url, options);
  fakeSockets.push(socket);
  return socket;
};

export const fakeSocketFor = (namespace: string): FakeSocket => {
  const socket = fakeSockets.find(s => s.url.endsWith(`/${namespace}`));
  if (!socket) {
    throw new Error(`No socket for /${namespace}`);
  }
  return socket;
};
