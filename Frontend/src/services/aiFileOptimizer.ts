import {
  aiApi,
  aiMaxFileBytes,
  aiOptimizeMaxBytes,
  unsupportedTypeReason,
} from '../api/aiApi';
import { imageCompressor } from './imageCompressor';
import { readActualSize } from './documentSizeGuard';
import { toAppError } from '../utils/errors';
import { formatFileSize } from '../utils/format';
import type { ImageCompressionStep, PickedFile } from '../types/ai';
import i18n from '../i18n';

// Each pass is stronger than the last; stop at the first that fits.
export const IMAGE_STEPS: readonly ImageCompressionStep[] = [
  { maxDimension: 2560, quality: 0.82 },
  { maxDimension: 2048, quality: 0.72 },
  { maxDimension: 1600, quality: 0.62 },
];

export type FileKind = 'image' | 'pdf' | 'docx' | 'text' | 'other';

export type PrepareStage = 'reading' | 'compressing' | 'optimizing';

export type PrepareOutcome =
  | { ok: true; file: PickedFile }
  | { ok: false; reason: string };

export interface PrepareProgress {
  file: PickedFile;
  stage: PrepareStage;
  index: number; // 1-based position in the batch
  total: number;
}

const extensionOf = (name: string): string =>
  (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();

export const detectKind = (file: PickedFile): FileKind => {
  const ext = extensionOf(file.name);
  const type = (file.type ?? '').toLowerCase();

  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return 'image';
  }
  if (type === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (type.includes('wordprocessingml') || ext === 'docx') {
    return 'docx';
  }
  if (type.startsWith('text/') || ['txt', 'md', 'csv'].includes(ext)) {
    return 'text';
  }
  return 'other';
};

export { readActualSize };

const limitLabel = () => formatFileSize(aiMaxFileBytes());

export const tooLargeToOptimizeReason = (name: string): string =>
  i18n.t('documents:files.tooLargeToOptimize', {
    name,
    limit: formatFileSize(aiOptimizeMaxBytes()),
  });

const cannotReduceReason = (name: string): string =>
  i18n.t('documents:files.cannotReduce', { name, limit: limitLabel() });

// Explains a failed optimize request without exposing transport details.
const optimizeFailureReason = (file: PickedFile, error: unknown): string => {
  const info = toAppError(error);
  if (info.isNetworkError) {
    return i18n.t('documents:files.optimizeSendFailed', { name: file.name, message: info.message });
  }
  switch (info.status) {
    case 413:
      return tooLargeToOptimizeReason(file.name);
    case 404:
      return i18n.t('documents:files.optimizeUnavailable', { name: file.name });
    case 400:
    case 409:
    case 415:
    case 422:
    case 503:
      return i18n.t('documents:files.withMessage', { name: file.name, message: info.message });
    default:
      if (info.status !== undefined && info.status >= 500) {
        return i18n.t('documents:files.optimizeServerFailed', { name: file.name });
      }
      return i18n.t('documents:files.withMessage', { name: file.name, message: info.message });
  }
};

async function compressImage(file: PickedFile, size: number): Promise<PrepareOutcome> {
  let smallest: number | null = null;

  for (const step of IMAGE_STEPS) {
    let candidate: PickedFile;
    try {
      candidate = await imageCompressor.compress(file, step);
    } catch (error) {
      return {
        ok: false,
        reason: i18n.t('documents:files.compressFailed', {
          name: file.name,
          message: toAppError(error).message,
        }),
      };
    }

    const candidateSize = await readActualSize(candidate);
    if (candidateSize !== null && candidateSize <= aiMaxFileBytes()) {
      return {
        ok: true,
        file: {
          ...candidate,
          size: candidateSize,
          optimization: { method: 'compressed', originalSize: size },
        },
      };
    }
    if (candidateSize !== null) {
      smallest = smallest === null ? candidateSize : Math.min(smallest, candidateSize);
    }
  }

  return {
    ok: false,
    reason: `${cannotReduceReason(file.name)}${
      smallest === null ? '' : i18n.t('documents:files.bestResult', { size: formatFileSize(smallest) })
    }`,
  };
}

async function optimizePdf(file: PickedFile, size: number): Promise<PrepareOutcome> {
  let result;
  try {
    result = await aiApi.optimizePdf(file);
  } catch (error) {
    return { ok: false, reason: optimizeFailureReason(file, error) };
  }

  // The server enforces this too; never keep a result over the limit.
  if (!result?.token || !(result.size > 0) || result.size > aiMaxFileBytes()) {
    return { ok: false, reason: cannotReduceReason(file.name) };
  }

  return {
    ok: true,
    file: {
      uri: '',
      name: result.name || file.name,
      type: 'application/pdf',
      size: result.size,
      preparedToken: result.token,
      optimization: { method: 'optimized', originalSize: result.originalSize || size },
    },
  };
}

/**
 * Makes one picked file ready for the AI assistant:
 * - Up to the limit (AI_UPLOAD_MAX_MB): used exactly as picked, never re-encoded.
 * - Over the optimization maximum (AI_OPTIMIZE_MAX_MB): refused before any upload.
 * - Images over the limit: compressed on the device, in progressively stronger passes.
 * - PDFs over the limit: optimized on the server; only the optimized copy is used.
 * - DOCX and text over the limit: refused. Their content is never altered.
 */
export async function prepareAiFile(
  file: PickedFile,
  onStage?: (stage: PrepareStage) => void,
): Promise<PrepareOutcome> {
  const typeReason = unsupportedTypeReason(file);
  if (typeReason) {
    return { ok: false, reason: typeReason };
  }

  onStage?.('reading');
  const size = await readActualSize(file);

  // Unknown size: send as picked; the server enforces the limit.
  if (size === null || size <= aiMaxFileBytes()) {
    return { ok: true, file: size === null ? file : { ...file, size } };
  }

  const kind = detectKind(file);

  if (kind === 'docx') {
    return {
      ok: false,
      reason: `${cannotReduceReason(file.name)}${i18n.t('documents:files.wordCannotReduce')}`,
    };
  }
  if (kind === 'text') {
    return {
      ok: false,
      reason: `${cannotReduceReason(file.name)}${i18n.t('documents:files.textCannotReduce')}`,
    };
  }
  if (kind === 'other') {
    return { ok: false, reason: i18n.t('documents:files.unsupported', { name: file.name }) };
  }

  if (size > aiOptimizeMaxBytes()) {
    return { ok: false, reason: tooLargeToOptimizeReason(file.name) };
  }

  if (kind === 'image') {
    onStage?.('compressing');
    return compressImage(file, size);
  }

  onStage?.('optimizing');
  return optimizePdf(file, size);
}

export interface PrepareManyResult {
  ready: PickedFile[];
  rejections: string[];
}

// Prepares files strictly one at a time, reporting which one is in progress.
export async function prepareAiFiles(
  files: PickedFile[],
  onProgress?: (progress: PrepareProgress) => void,
): Promise<PrepareManyResult> {
  const ready: PickedFile[] = [];
  const rejections: string[] = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const outcome = await prepareAiFile(file, stage =>
      onProgress?.({ file, stage, index: i + 1, total: files.length }),
    );
    if (outcome.ok) {
      ready.push(outcome.file);
    } else {
      rejections.push(outcome.reason);
    }
  }

  return { ready, rejections };
}

export const describeOptimization = (file: PickedFile): string | null => {
  if (!file.optimization || file.size === null) {
    return null;
  }
  return i18n.t('documents:files.optimizedSummary', {
    original: formatFileSize(file.optimization.originalSize),
    optimized: formatFileSize(file.size),
  });
};

export const progressLabel = ({ file, stage, index, total }: PrepareProgress): string => {
  const action =
    stage === 'reading'
      ? i18n.t('documents:files.checking', { name: file.name })
      : i18n.t('documents:files.optimizing', { name: file.name });
  return total > 1 ? i18n.t('documents:files.optimizingProgress', { index, total, action }) : action;
};
