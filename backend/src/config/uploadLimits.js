const { requiredNumber } = require("./env");
const MB = 1024 * 1024;

// Hard maximum for any uploaded document: 10 MiB = 10,485,760 bytes.
// A file of exactly this size is accepted; one byte more is rejected.
const MAX_DOCUMENT_SIZE = 10 * MB;

const FILE_TOO_LARGE_MESSAGE =
  "Files above 10 MB are not acceptable. Please upload a file that is 10 MB or smaller.";

const fileTooLargeBody = () => ({
  success: false,
  code: "FILE_TOO_LARGE",
  message: FILE_TOO_LARGE_MESSAGE,
});

// Largest document the AI Smart Case Assistant accepts as is (AI_UPLOAD_MAX_MB,
// never above MAX_DOCUMENT_SIZE).
const AI_UPLOAD_MAX_MB = Math.min(
  requiredNumber("AI_UPLOAD_MAX_MB"),
  MAX_DOCUMENT_SIZE / MB
);

// Largest original the optimize endpoint will receive and try to shrink.
// Never above MAX_DOCUMENT_SIZE: nothing over 10 MB is accepted anywhere.
const AI_OPTIMIZE_MAX_MB = Math.min(
  Math.max(requiredNumber("AI_OPTIMIZE_MAX_MB"), AI_UPLOAD_MAX_MB),
  MAX_DOCUMENT_SIZE / MB
);

const formatMb = (mb) => `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;

module.exports = {
  MAX_DOCUMENT_SIZE,
  FILE_TOO_LARGE_MESSAGE,
  fileTooLargeBody,
  AI_MAX_FILE_BYTES: Math.floor(AI_UPLOAD_MAX_MB * MB),
  AI_OPTIMIZE_MAX_INPUT_BYTES: Math.floor(AI_OPTIMIZE_MAX_MB * MB),
  AI_MAX_FILE_LABEL: formatMb(AI_UPLOAD_MAX_MB),
  AI_OPTIMIZE_MAX_LABEL: formatMb(AI_OPTIMIZE_MAX_MB),
  AI_MAX_DOCUMENTS: 10,
};
