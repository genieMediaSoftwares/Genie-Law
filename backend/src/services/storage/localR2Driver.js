// FILE_STORAGE=local: a local R2 bucket for development, run by Miniflare (the
// engine behind `wrangler dev`). Files are kept in backend/.wrangler/state/v3/r2
// and can be browsed in Cloudflare's Local Explorer at
//   http://127.0.0.1:<LOCAL_STORAGE_EXPLORER_PORT>/cdn-cgi/local/explorer
// The same Miniflare instance serves the bucket to this process and the
// Explorer, so both always see the same files.
//
// Miniflare is a dev dependency; config/storage.js refuses this mode when
// NODE_ENV=production.

const path = require("path");
const { getBucketName, readExplorerPort } = require("../../config/storage");

// Miniflare keeps each resource type in a subfolder (R2 in .../v3/r2), the same
// layout `wrangler dev` uses.
const STATE_DIR = path.resolve(__dirname, "../../../.wrangler/state/v3");
// The Local Explorer lists only workers registered in a dev registry (wrangler
// dev always has one); without it the bucket is missing from its sidebar.
const REGISTRY_DIR = path.resolve(__dirname, "../../../.wrangler/registry");
const BINDING = "FILES";

let starting = null;
let instance = null;

function explorerUrl() {
  return `http://127.0.0.1:${readExplorerPort()}/cdn-cgi/local/explorer`;
}

async function bucket() {
  if (!starting) {
    starting = (async () => {
      const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
      const mf = new Miniflare(
        convertV4MiniflareOptions({
          name: "genielaw-local-storage",
          modules: true,
          // Any other path on this port opens the Local Explorer.
          script:
            "export default { fetch(request) { return Response.redirect(new URL('/cdn-cgi/local/explorer', request.url).href, 302); } };",
          compatibilityDate: "2026-09-24",
          r2Buckets: { [BINDING]: getBucketName() },
          resourcePersistencePath: STATE_DIR,
          unsafeDevRegistryPath: REGISTRY_DIR,
          host: "127.0.0.1",
          port: readExplorerPort(),
          unsafeLocalExplorer: true,
        })
      );
      await mf.ready;
      instance = mf;
      return mf.getR2Bucket(BINDING);
    })().catch((error) => {
      starting = null;
      throw error;
    });
  }
  return starting;
}

async function start() {
  await bucket();
  return `local R2 bucket "${getBucketName()}" (Cloudflare Local Explorer: ${explorerUrl()})`;
}

async function stop() {
  const mf = instance;
  instance = null;
  starting = null;
  if (mf) await mf.dispose();
}

async function put(key, body, contentType) {
  await (await bucket()).put(key, body, { httpMetadata: { contentType } });
}

// `range` is { start, end } (inclusive) or undefined.
async function get(key, range) {
  const object = await (await bucket()).get(
    key,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined
  );
  return object ? Buffer.from(await object.arrayBuffer()) : null;
}

async function head(key) {
  const object = await (await bucket()).head(key);
  if (!object) return null;
  return {
    size: object.size,
    contentType: object.httpMetadata?.contentType || null,
    uploadedAt: object.uploaded,
  };
}

async function remove(key) {
  await (await bucket()).delete(key);
}

async function copy(fromKey, toKey, contentType) {
  const data = await get(fromKey);
  if (!data) throw new Error(`File not found: ${fromKey}`);
  await put(toKey, data, contentType);
}

async function list(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await (await bucket()).list({ prefix, cursor });
    for (const object of page.objects) {
      out.push({ key: object.key, size: object.size, uploadedAt: object.uploaded });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function ping() {
  await (await bucket()).head("uploads/.health");
}

module.exports = { start, stop, put, get, head, remove, copy, list, ping };
