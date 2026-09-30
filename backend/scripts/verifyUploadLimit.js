// Verifies the 10 MB document limit end to end at the upload layer, with the
// file store mocked so nothing touches R2. Run: node scripts/verifyUploadLimit.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const assert = require("assert");
const path = require("path");

const saved = [];
const removed = [];
const fileStorePath = require.resolve(path.join(__dirname, "../src/services/fileStore"));
require.cache[fileStorePath] = {
  id: fileStorePath, filename: fileStorePath, loaded: true,
  exports: {
    save: async (key) => { saved.push(key); },
    remove: async (key) => { removed.push(key); },
  },
};

const express = require("express");
const multer = require("multer");
const upload = require("../src/middleware/upload.middleware");
const { MAX_DOCUMENT_SIZE, fileTooLargeBody } = require("../src/config/uploadLimits");
const { validateUpload } = require("../src/services/case/caseSubmissionService");
const errorMiddleware = require("../src/middleware/errorMiddleware");

const handle = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json(fileTooLargeBody());
    }
    return next(err);
  });

const app = express();
app.post("/api/ai/smart-case/analyze", handle(upload.fields([{ name: "documents", maxCount: 10 }])), (req, res) =>
  res.json({ success: true, count: (req.files.documents || []).length }));
app.post("/api/cases/submit", handle(upload.submission.array("documents", 11)), (req, res) =>
  res.json({ success: true, count: req.files.length }));
app.post("/api/documents", upload.single("acknowledgement"), (req, res) => res.json({ success: true }));
app.use(errorMiddleware.errorHandler || errorMiddleware);

const post = async (base, url, sizes, field = "documents") => {
  const form = new FormData();
  sizes.forEach((size, i) =>
    form.append(field, new Blob([Buffer.alloc(size, 0x20)], { type: "text/plain" }), `f${i}.txt`));
  const res = await fetch(base + url, { method: "POST", body: form });
  return { status: res.status, body: await res.json() };
};

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const MB = 1024 * 1024;
  try {
    assert.strictEqual(MAX_DOCUMENT_SIZE, 10485760);

    for (const size of [1 * MB, 5 * MB, Math.floor(9.99 * MB), MAX_DOCUMENT_SIZE]) {
      const r = await post(base, "/api/ai/smart-case/analyze", [size]);
      assert.strictEqual(r.status, 200, `size ${size} should be accepted`);
    }
    console.log("ok  1/5/9.99/exactly-10 MB accepted");

    for (const size of [MAX_DOCUMENT_SIZE + 1, 11 * MB, 20 * MB]) {
      saved.length = 0;
      const r = await post(base, "/api/ai/smart-case/analyze", [size]);
      assert.strictEqual(r.status, 413);
      assert.deepStrictEqual(r.body, fileTooLargeBody());
      assert.strictEqual(saved.length, 0, "oversized file must not reach storage");
    }
    console.log("ok  10,485,761 B / 11 MB / 20 MB → 413 FILE_TOO_LARGE, nothing stored");

    saved.length = 0; removed.length = 0;
    let r = await post(base, "/api/ai/smart-case/analyze", [3 * MB, 7 * MB, 15 * MB]);
    assert.strictEqual(r.status, 413);
    assert.deepStrictEqual([...removed].sort(), [...saved].sort(), "valid parts of a rejected request are cleaned up");
    console.log(`ok  mixed 3/7/15 MB request → 413; ${saved.length} partial object(s) stored and all removed`);

    r = await post(base, "/api/cases/submit", [3 * MB, 15 * MB]);
    assert.strictEqual(r.status, 413);
    assert.strictEqual(r.body.code, "FILE_TOO_LARGE");
    console.log("ok  Submit Case with an oversized document → 413 FILE_TOO_LARGE");

    saved.length = 0;
    r = await post(base, "/api/documents", [11 * MB], "acknowledgement");
    assert.strictEqual(r.status, 413);
    assert.strictEqual(r.body.code, "FILE_TOO_LARGE");
    assert.strictEqual(saved.length, 0);
    console.log("ok  generic upload route (global error handler) → 413 FILE_TOO_LARGE");

    // Service-level guard, independent of multer (e.g. forged size metadata).
    const txt = (n, size) => ({ originalname: "a.txt", mimetype: "text/plain", size, buffer: Buffer.alloc(n, 0x20) });
    assert.doesNotThrow(() => validateUpload(txt(MAX_DOCUMENT_SIZE, MAX_DOCUMENT_SIZE)));
    assert.throws(() => validateUpload(txt(MAX_DOCUMENT_SIZE + 1, 10)), (e) => e.statusCode === 413 && e.code === "FILE_TOO_LARGE");
    console.log("ok  validateUpload: exactly 10 MB accepted, 10,485,761 B rejected even with forged size");

    console.log("\nAll upload-limit checks passed.");
  } finally {
    server.close();
  }
})().catch((e) => { console.error("FAIL", e); process.exitCode = 1; });
