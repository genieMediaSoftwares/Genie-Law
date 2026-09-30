// Realtime server: Socket.IO on the backend's HTTP server, at /socket.io/.
//
//   auth.js        token check on namespace connect
//   namespaces.js  namespaces and client -> server event handlers
//   emitter.js     server -> client delivery from controllers and services
//   events.js      the named events the backend emits
//
// socket.io-client connects with `auth: { token }`. Sockets in authenticated
// namespaces join a room named after their user id.

const { Server } = require("socket.io");
const { authenticate } = require("./auth");
const { isAllowedOrigin } = require("../config/cors");
const { ALL_NAMESPACES, AUTHENTICATED_NAMESPACES, findHandler } = require("./namespaces");

let io = null;

function setupNamespace(namespace) {
  const nsp = io.of(namespace);

  if (AUTHENTICATED_NAMESPACES.has(namespace)) {
    nsp.use(async (socket, next) => {
      try {
        const identity = await authenticate(socket.handshake.auth);
        socket.data.userId = identity.userId;
        socket.data.role = identity.role;
        next();
      } catch (error) {
        next(new Error(error.message));
      }
    });
  }

  nsp.on("connection", (socket) => {
    socket.data.chatRooms = [];
    if (socket.data.userId) socket.join(socket.data.userId);

    socket.onAny(async (event, ...args) => {
      const ackFn = typeof args[args.length - 1] === "function" ? args.pop() : null;
      const ack = (result) => {
        if (ackFn) ackFn(result);
      };
      const handler = findHandler(namespace, event);
      if (!handler) return ack({ ok: false, reason: "unknown_event" });
      try {
        await handler({
          socket,
          payload: args[0],
          ack,
          sendError: (message) => socket.emit("error", { message }),
        });
      } catch (error) {
        console.warn(`[realtime] ${namespace} ${event} failed:`, error.message);
      }
      return undefined;
    });
  });
}

function attachRealtime(httpServer) {
  if (io) return io;
  io = new Server(httpServer, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    serveClient: false,
    cors: {
      // Native apps send no Origin; browsers must be in ALLOWED_ORIGINS.
      origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
      credentials: true,
    },
  });
  for (const namespace of ALL_NAMESPACES) setupNamespace(namespace);
  return io;
}

const getIO = () => io;

async function closeRealtime() {
  if (!io) return;
  const current = io;
  io = null;
  await new Promise((resolve) => current.close(() => resolve()));
}

module.exports = { attachRealtime, getIO, closeRealtime };
