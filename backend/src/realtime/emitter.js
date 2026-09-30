// Delivers server -> client events from controllers, services and maintenance
// to the connected sockets (socketServer.js). Delivery is fire-and-forget: it
// never throws and never delays the response. Outside the server process
// (scripts), there is no realtime server and events are dropped.

const { getIO } = require("./socketServer");

// Sends `event` to sockets in `namespace`, limited to `room` when given.
function emit({ namespace, room = null, event, payload }) {
  const io = getIO();
  if (!io || !event) return;
  try {
    // Plain JSON, as clients received it before (documents, ObjectIds and
    // dates become their JSON forms).
    const data = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
    const target = room === null ? io.of(namespace) : io.of(namespace).to(String(room));
    if (data === undefined) target.emit(event);
    else target.emit(event, data);
  } catch (error) {
    console.warn(`[realtime] ${event} not delivered:`, error.message);
  }
}

module.exports = { emit };
