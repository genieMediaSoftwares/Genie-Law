// Work that continues after the response has been sent (AI analysis, calendar
// sync, notifications). It runs in this process; pending work is tracked so a
// graceful shutdown (Render sends SIGTERM on deploys) can wait for it.

const pending = new Set();

function track(promise) {
  const settled = Promise.resolve(promise).catch(() => {});
  pending.add(settled);
  settled.finally(() => pending.delete(settled));
  return promise;
}

// Starts `task` (a function returning a promise) without waiting for it.
// Failures are logged under `label`, never thrown.
function runInBackground(label, task) {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(`[background] ${label} failed:`, error && error.message ? error.message : error);
    });
  return track(promise);
}

// Tracks `promise` until it settles and returns it unchanged, so services can
// be called either awaited or fire-and-forget.
function keepAlive(promise) {
  return track(promise);
}

// Resolves when all tracked work has settled, or after `timeoutMs`.
// Returns the number of tasks still running at that point.
async function drainBackground(timeoutMs) {
  if (!pending.size) return 0;
  let timer;
  await Promise.race([
    Promise.all([...pending]),
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  return pending.size;
}

module.exports = { runInBackground, keepAlive, drainBackground };
