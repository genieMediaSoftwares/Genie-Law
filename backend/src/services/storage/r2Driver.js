// FILE_STORAGE=r2: Cloudflare R2 through its S3-compatible API.
// Keys arrive already validated by fileStore.

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} = require("@aws-sdk/client-s3");
const { required } = require("../../config/env");
const { getBucketName, readEndpoint } = require("../../config/storage");

let client = null;
function getClient() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: readEndpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
      // Only send/verify checksums when an operation requires them; R2 does
      // not support every checksum algorithm newer SDKs add by default.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

const send = (command) => getClient().send(command);

const isNotFound = (error) =>
  Boolean(
    error &&
      (error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        error.Code === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404)
  );

async function start() {
  return `Cloudflare R2 bucket "${getBucketName()}"`;
}

async function stop() {}

async function put(key, body, contentType) {
  await send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    })
  );
}

// `range` is { start, end } (inclusive) or undefined.
async function get(key, range) {
  try {
    const result = await send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      })
    );
    return Buffer.from(await result.Body.transformToByteArray());
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function head(key) {
  try {
    const result = await send(new HeadObjectCommand({ Bucket: getBucketName(), Key: key }));
    return {
      size: Number(result.ContentLength) || 0,
      contentType: result.ContentType || null,
      uploadedAt: result.LastModified,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function remove(key) {
  await send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

async function copy(fromKey, toKey, contentType) {
  const bucket = getBucketName();
  await send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: toKey,
      CopySource: `${bucket}/${fromKey.split("/").map(encodeURIComponent).join("/")}`,
      ContentType: contentType,
      MetadataDirective: "REPLACE",
    })
  );
}

async function list(prefix) {
  const out = [];
  let ContinuationToken;
  do {
    const page = await send(new ListObjectsV2Command({ Bucket: getBucketName(), Prefix: prefix, ContinuationToken }));
    for (const object of page.Contents || []) {
      out.push({ key: object.Key, size: Number(object.Size) || 0, uploadedAt: object.LastModified });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

async function ping() {
  await send(new HeadBucketCommand({ Bucket: getBucketName() }));
}

module.exports = { start, stop, put, get, head, remove, copy, list, ping };
