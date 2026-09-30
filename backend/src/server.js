// Backend entry point (Render start command: `npm start`).
//
//   1. check configuration (missing settings stop the process with their names)
//   2. connect to MongoDB Atlas
//   3. serve the Express app and Socket.IO on PORT
//   4. run maintenance every 15 minutes
//   5. on SIGTERM/SIGINT (Render deploys and restarts): stop accepting
//      connections, let running work finish, close the database, exit

const http = require("http");
const { validateStartupEnv, required, requiredNumber } = require("./config/env");

// Before anything else loads: most modules read their settings when required.
try {
  validateStartupEnv();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

const { connectDatabase, disconnectDatabase } = require("./config/database");
const fileStore = require("./services/fileStore");
const app = require("./app");
const { attachRealtime, closeRealtime } = require("./realtime/socketServer");
const { drainBackground } = require("./utils/background");
const { startMaintenanceSchedule, stopMaintenanceSchedule } = require("./utils/maintenance");

// Render allows 30 s between SIGTERM and SIGKILL by default.
const SHUTDOWN_GRACE_MS = 25000;

let server = null;
let shuttingDown = false;

async function start() {
  const port = requiredNumber("PORT");
  await connectDatabase();
  console.log(`✅ File storage: ${await fileStore.start()}`);

  server = http.createServer(app);
  // Longer than typical load balancer idle timeouts, so the proxy never reuses a
  // connection this server has already closed.
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  attachRealtime(server);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  console.log(`🚀 Genie Law backend listening on port ${port} (${required("NODE_ENV")})`);

  startMaintenanceSchedule();
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, closing`);
  const force = setTimeout(() => {
    console.error("[shutdown] timed out, exiting");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS + 3000);
  force.unref();

  try {
    await closeRealtime();
    if (server) {
      server.close();
      if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    }
    await stopMaintenanceSchedule();
    const left = await drainBackground(SHUTDOWN_GRACE_MS);
    if (left) console.warn(`[shutdown] ${left} background task(s) still running; maintenance will recover them`);
    await disconnectDatabase();
    await fileStore.stop();
    console.log("[shutdown] done");
    process.exit(0);
  } catch (error) {
    console.error("[shutdown] error:", error.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandled rejection:", reason && reason.message ? reason.message : reason);
});

start().catch((error) => {
  console.error(`❌ Startup failed: ${error.message}`);
  process.exit(1);
});
