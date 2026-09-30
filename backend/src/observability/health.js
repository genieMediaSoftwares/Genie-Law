// Health checks. Neither response includes configuration values, hosts or
// credentials — only component status.
//
//   GET /health        liveness for Render's health check: the process is up
//                      and holds a MongoDB connection (no network round trip).
//   GET /health/ready  readiness: pings MongoDB and checks the R2 bucket.

const { isDatabaseConnected, pingDatabase } = require("../config/database");
const fileStore = require("../services/fileStore");

const CHECK_TIMEOUT_MS = 5000;

async function timed(check) {
  const start = Date.now();
  let timer;
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timed out")), CHECK_TIMEOUT_MS);
      }),
    ]);
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch {
    // The error text can name hosts or buckets; it is logged, not returned.
    return { status: "unhealthy", latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

function liveness() {
  const database = isDatabaseConnected() ? "connected" : "disconnected";
  return {
    ok: database === "connected",
    status: database === "connected" ? "ok" : "degraded",
    checks: { database },
    uptimeSeconds: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  };
}

async function readiness() {
  const [database, storage] = await Promise.all([timed(pingDatabase), timed(() => fileStore.ping())]);
  const ok = database.status === "healthy" && storage.status === "healthy";
  if (!ok) console.warn("[health] not ready:", JSON.stringify({ database: database.status, storage: storage.status }));
  return { ok, status: ok ? "ready" : "not_ready", checks: { database, storage }, ts: new Date().toISOString() };
}

module.exports = { liveness, readiness };
