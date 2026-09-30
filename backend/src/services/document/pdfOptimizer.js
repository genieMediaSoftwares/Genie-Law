const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { AI_MAX_FILE_BYTES, AI_MAX_FILE_LABEL } = require("../../config/uploadLimits");
const { optional } = require("../../config/env");

const PASS_TIMEOUT_MS = 90 * 1000;

// Only embedded images are resampled. Text, fonts and vector content are
// rewritten as-is, so the legal wording of the document never changes.
// Black-and-white scans keep 300 dpi, which OCR needs to read them.
const PASSES = [
  { name: "standard", resolution: 150 },
  { name: "strong", resolution: 110 },
];

class PdfOptimizationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PdfOptimizationError";
    this.code = code;
    Object.assign(this, details);
  }
}

const candidateBinaries = () => {
  const configured = optional("GHOSTSCRIPT_PATH");
  return configured ? [configured] : [];
};

const run = (binary, args, timeout) =>
  new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(String(stdout || ""));
      }
    );
  });

// Ghostscript announces "Processing pages 1 through N." and prints "Page n"
// for each page it writes. A pass that did not write every page is discarded.
const allPagesWritten = (stdout) => {
  const declared = /Processing pages \d+ through (\d+)\./.exec(stdout);
  const written = (stdout.match(/^Page \d+\s*$/gm) || []).length;
  if (written === 0) return false;
  return declared ? written === Number(declared[1]) : true;
};

let cachedBinary;

async function findGhostscript() {
  if (cachedBinary !== undefined) return cachedBinary;
  for (const binary of candidateBinaries()) {
    try {
      await run(binary, ["--version"], 10 * 1000);
      cachedBinary = binary;
      return binary;
    } catch {
      // Try the next candidate.
    }
  }
  cachedBinary = null;
  return null;
}

const resetGhostscriptCache = () => {
  cachedBinary = undefined;
};

const ghostscriptArgs = (input, output, resolution) => [
  "-sDEVICE=pdfwrite",
  "-dCompatibilityLevel=1.5",
  "-dPDFSETTINGS=/ebook",
  "-dSAFER",
  "-dBATCH",
  "-dNOPAUSE",
  "-dDetectDuplicateImages=true",
  "-dCompressFonts=true",
  "-dDownsampleColorImages=true",
  "-dDownsampleGrayImages=true",
  "-dDownsampleMonoImages=true",
  `-dColorImageResolution=${resolution}`,
  `-dGrayImageResolution=${resolution}`,
  "-dMonoImageResolution=300",
  `-sOutputFile=${output}`,
  input,
];

async function hasPdfHeader(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);
    return buffer.toString("latin1") === "%PDF-";
  } finally {
    await handle.close();
  }
}

const removeQuietly = (filePath) =>
  filePath ? fs.promises.unlink(filePath).catch(() => {}) : Promise.resolve();

const formatMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * Shrinks a PDF until it fits targetBytes, trying progressively stronger
 * passes. Returns the path of the file to keep: the input itself when it
 * already fits, otherwise a new temporary file the caller owns.
 */
async function optimizePdf(inputPath, { targetBytes = AI_MAX_FILE_BYTES } = {}) {
  const originalSize = (await fs.promises.stat(inputPath)).size;

  if (!(await hasPdfHeader(inputPath))) {
    throw new PdfOptimizationError("INVALID_PDF", "This file is not a valid PDF.");
  }

  if (originalSize <= targetBytes) {
    return { path: inputPath, size: originalSize, originalSize, optimized: false, passes: 0 };
  }

  const binary = await findGhostscript();
  if (!binary) {
    throw new PdfOptimizationError(
      "UNAVAILABLE",
      `PDF optimization is not available on the server right now. Please upload a PDF of ${AI_MAX_FILE_LABEL} or less.`
    );
  }

  let best = null;
  let passes = 0;

  for (const pass of PASSES) {
    const output = path.join(
      os.tmpdir(),
      `pdf-opt-${crypto.randomBytes(8).toString("hex")}.pdf`
    );
    passes += 1;

    try {
      const stdout = await run(
        binary,
        ghostscriptArgs(inputPath, output, pass.resolution),
        PASS_TIMEOUT_MS
      );
      if (!allPagesWritten(stdout)) throw new Error("Not every page was written.");
      if (!(await hasPdfHeader(output))) throw new Error("Output is not a PDF.");
      const size = (await fs.promises.stat(output)).size;
      if (size <= 0) throw new Error("Output is empty.");

      if (!best || size < best.size) {
        if (best) await removeQuietly(best.path);
        best = { path: output, size };
      } else {
        await removeQuietly(output);
      }
    } catch {
      await removeQuietly(output);
      continue;
    }

    if (best.size <= targetBytes) break;
  }

  if (!best) {
    throw new PdfOptimizationError(
      "FAILED",
      "This PDF could not be optimized. It may be password-protected or damaged."
    );
  }

  if (best.size > targetBytes) {
    await removeQuietly(best.path);
    throw new PdfOptimizationError(
      "STILL_TOO_LARGE",
      `Unable to reduce this PDF below ${formatMb(
        targetBytes
      )} without compromising document quality. The best result was ${formatMb(
        best.size
      )}. Please upload fewer pages or split it into smaller PDFs.`,
      { bestSize: best.size }
    );
  }

  return { path: best.path, size: best.size, originalSize, optimized: true, passes };
}

/**
 * optimizePdf for a file held in memory (uploads live in the file store, not
 * on disk). Ghostscript needs real files, so they are written to the temp
 * directory only when a PDF actually has to be shrunk (and removed afterwards).
 * Without Ghostscript (GHOSTSCRIPT_PATH), oversized PDFs are refused as UNAVAILABLE.
 */
async function optimizePdfBuffer(buffer, { targetBytes = AI_MAX_FILE_BYTES } = {}) {
  const originalSize = buffer.length;
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new PdfOptimizationError("INVALID_PDF", "This file is not a valid PDF.");
  }
  if (originalSize <= targetBytes) {
    return { buffer, size: originalSize, originalSize, optimized: false, passes: 0 };
  }
  if (!(await findGhostscript())) {
    throw new PdfOptimizationError(
      "UNAVAILABLE",
      `PDF optimization is not available on the server right now. Please upload a PDF of ${AI_MAX_FILE_LABEL} or less.`
    );
  }

  const input = path.join(os.tmpdir(), `pdf-in-${crypto.randomBytes(8).toString("hex")}.pdf`);
  await fs.promises.writeFile(input, buffer);
  let result;
  try {
    result = await optimizePdf(input, { targetBytes });
    const output = await fs.promises.readFile(result.path);
    return { ...result, buffer: output, path: undefined };
  } finally {
    await removeQuietly(input);
    if (result && result.path !== input) await removeQuietly(result.path);
  }
}

module.exports = {
  optimizePdf,
  optimizePdfBuffer,
  allPagesWritten,
  findGhostscript,
  resetGhostscriptCache,
  PdfOptimizationError,
  PASSES,
};
