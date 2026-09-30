// Periodic clean-up, run every 15 minutes inside the server process
// (startMaintenanceSchedule, called by server.js). Every step is idempotent,
// so running it on more than one instance is harmless.
//
// Each step is independent: one failing does not stop the others.

const { failStaleSessions } = require("../controllers/ai/aiSmartCaseController");
const preparedDocuments = require("../services/ai/preparedDocuments");
const tempFiles = require("../services/ai/tempFiles");
const tempSessions = require("../services/ai/tempSessionStore");
const { recoverAbandonedResearch } = require("../services/ai/legalResearchService");
const RefreshToken = require("../models/RefreshToken");

// A research run with no progress for this long is treated as abandoned.
const STALE_RESEARCH_MS = 30 * 60 * 1000;

async function step(label, work) {
  try {
    const result = await work();
    if (typeof result === "number" && result > 0) {
      console.log(`[maintenance] ${label}: ${result}`);
    }
  } catch (error) {
    console.error(`[maintenance] ${label} failed:`, error && error.message ? error.message : error);
  }
}

async function runMaintenance(now = new Date()) {
  const at = now.getTime();
  await step("stale AI analyses failed", () => failStaleSessions());
  await step("abandoned research reset", () =>
    recoverAbandonedResearch({ olderThan: new Date(at - STALE_RESEARCH_MS) })
  );
  await step("expired prepared documents removed", () => preparedDocuments.sweep(at));
  await step("expired temporary uploads removed", () => tempFiles.sweep(at));
  await step("unsubmitted AI drafts removed", () => tempSessions.sweep(at));
  await step("expired refresh tokens removed", async () => {
    const { deletedCount } = await RefreshToken.deleteMany({ expiresAt: { $lt: now } });
    return deletedCount;
  });
}

const MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;

let timer = null;
let running = null;

// Runs maintenance now and then every 15 minutes; never overlaps a run.
function startMaintenanceSchedule() {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = runMaintenance(new Date()).finally(() => {
      running = null;
    });
  };
  timer = setInterval(tick, MAINTENANCE_INTERVAL_MS);
  timer.unref();
  tick();
}

// Stops the schedule and waits for a run in progress.
async function stopMaintenanceSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
  if (running) await running;
}

module.exports = { runMaintenance, startMaintenanceSchedule, stopMaintenanceSchedule };
