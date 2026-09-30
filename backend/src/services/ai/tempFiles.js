// Files sent to the AI assistant (documents to read, voice notes) are inputs
// to processing, not case documents. The upload middleware stores them under
// uploads/ai-temp/; they are removed as soon as processing ends, and anything
// left behind by an interrupted request is swept by maintenance.
// A document only becomes permanent when the client submits the case
// (services/case/caseSubmissionService).

const fileStore = require("../fileStore");
const log = require("../../utils/aiLogger");

const TEMP_PREFIX = "uploads/ai-temp";
// Longer than the analysis budget, so a running analysis never loses its input.
const MAX_AGE_MS = 30 * 60 * 1000;

const isTempKey = (key) => typeof key === "string" && key.startsWith(`${TEMP_PREFIX}/`);

// Removes the temporary copies of `files` (multer-style objects with `path`).
// Files that are not temporary — such as optimized PDFs held for submission —
// are left alone.
async function removeTempFiles(files) {
  await Promise.all(
    (files || [])
      .filter((file) => file && isTempKey(file.path))
      .map((file) =>
        fileStore
          .remove(file.path)
          .catch((error) => log.warn("temp-files:remove-failed", { path: file.path, error: error.message }))
      )
  );
}

async function sweep(now = Date.now()) {
  let removed = 0;
  for (const entry of await fileStore.list(`${TEMP_PREFIX}/`)) {
    const uploadedAt = entry.uploadedAt ? new Date(entry.uploadedAt).getTime() : 0;
    if (now - uploadedAt > MAX_AGE_MS && (await fileStore.remove(entry.key))) removed += 1;
  }
  return removed;
}

module.exports = { TEMP_PREFIX, MAX_AGE_MS, isTempKey, removeTempFiles, sweep };
