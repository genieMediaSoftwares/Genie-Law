// File storage configuration. FILE_STORAGE picks where uploaded files go:
//
//   r2     Cloudflare R2 through its S3-compatible API (deployment).
//            R2_ENDPOINT           https://<account id>.r2.cloudflarestorage.com
//            R2_ACCESS_KEY_ID      R2 API token access key (Object Read & Write, this bucket)
//            R2_SECRET_ACCESS_KEY  R2 API token secret
//            R2_BUCKET_NAME        bucket holding every uploaded file (private)
//
//   local  A local R2 bucket (Miniflare, the engine behind `wrangler dev`),
//          kept in backend/.wrangler/state/v3/r2 and browsable in Cloudflare's
//          Local Explorer. Development only: refused when NODE_ENV=production.
//            R2_BUCKET_NAME                bucket name
//            LOCAL_STORAGE_EXPLORER_PORT   port for the Local Explorer
//
// Every value comes from the environment. Credentials stay on the server:
// clients only ever receive /uploads/... paths served by this backend.

const { required, requiredNumber } = require("./env");

const MODES = ["r2", "local"];

function getStorageMode() {
  const mode = required("FILE_STORAGE").toLowerCase();
  if (!MODES.includes(mode)) {
    throw new Error(`FILE_STORAGE must be one of: ${MODES.join(", ")} (got "${mode}").`);
  }
  if (mode === "local" && required("NODE_ENV") === "production") {
    throw new Error("FILE_STORAGE=local is for local development only. Use FILE_STORAGE=r2 in production.");
  }
  return mode;
}

// Settings the chosen mode needs, for the startup check.
const requiredFor = (mode) =>
  mode === "r2"
    ? ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]
    : ["R2_BUCKET_NAME", "LOCAL_STORAGE_EXPLORER_PORT"];

const getBucketName = () => required("R2_BUCKET_NAME");

function readEndpoint() {
  const endpoint = required("R2_ENDPOINT").replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+$/i.test(endpoint)) {
    throw new Error("R2_ENDPOINT must be the bucket endpoint origin, e.g. https://<account id>.r2.cloudflarestorage.com.");
  }
  return endpoint;
}

function readExplorerPort() {
  const port = requiredNumber("LOCAL_STORAGE_EXPLORER_PORT");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("LOCAL_STORAGE_EXPLORER_PORT must be a port number (1-65535).");
  }
  return port;
}

module.exports = { getStorageMode, requiredFor, getBucketName, readEndpoint, readExplorerPort };
