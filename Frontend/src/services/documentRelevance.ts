import { aiApi } from '../api/aiApi';
import { toAppError } from '../utils/errors';
import type {
  DocumentRelevance,
  PickedFile,
  RelevanceContext,
} from '../types/ai';
import i18n from '../i18n';

// Checks chosen documents against the case with the AI, one request per
// document, before they are accepted anywhere in the app. The files stay on
// the device; the server reads each one in memory and keeps nothing.
//
// A document is only ever "accepted" on a confident yes from the server. A
// "no" rejects it, and a failed check (timeout, network, bad AI answer) is
// reported as a failure the user can retry — never treated as accepted.

// Parallel checks, kept low to respect the AI provider's rate limits.
const CONCURRENCY = 2;

export interface RejectedDocument {
  file: PickedFile;
  documentType: string;
  reason: string;
}

export interface FailedDocument {
  file: PickedFile;
  message: string;
}

export interface RelevanceOutcome {
  accepted: PickedFile[];
  rejected: RejectedDocument[];
  failed: FailedDocument[];
}

// Messages are functions so they follow the current language.
export const verificationFailedMessage = (): string =>
  i18n.t('documents:relevance.verificationFailed');

export const notRelevantMessage = (): string => i18n.t('documents:relevance.notRelevant');

export const noRelevantDocumentMessage = (): string =>
  i18n.t('documents:relevance.noRelevantDocument');

export async function verifyDocuments(
  files: PickedFile[],
  context: RelevanceContext,
  onChecked?: (file: PickedFile, done: number, total: number) => void,
): Promise<RelevanceOutcome> {
  const outcome: RelevanceOutcome = { accepted: [], rejected: [], failed: [] };
  const results = new Array<
    | { kind: 'accepted'; file: PickedFile }
    | { kind: 'rejected'; value: RejectedDocument }
    | { kind: 'failed'; value: FailedDocument }
  >(files.length);

  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < files.length) {
      const index = next;
      next += 1;
      const file = files[index];
      try {
        const result = await aiApi.checkRelevance(file, context);
        if (result.accepted && result.verificationToken) {
          results[index] = {
            kind: 'accepted',
            file: { ...file, relevance: result as DocumentRelevance },
          };
        } else {
          results[index] = {
            kind: 'rejected',
            value: {
              file,
              documentType: result.documentType,
              reason: result.reason,
            },
          };
        }
      } catch (error) {
        const appError = toAppError(error);
        results[index] = {
          kind: 'failed',
          value: {
            file,
            // A problem with the file itself (type, size, expired) is worth
            // showing; anything else is a verification failure to retry.
            message:
              appError.status && appError.status < 500 && appError.status !== 408
                ? appError.message
                : verificationFailedMessage(),
          },
        };
      }
      done += 1;
      onChecked?.(file, done, files.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker),
  );

  // Keep the order the user chose.
  for (const result of results) {
    if (result.kind === 'accepted') {
      outcome.accepted.push(result.file);
    } else if (result.kind === 'rejected') {
      outcome.rejected.push(result.value);
    } else {
      outcome.failed.push(result.value);
    }
  }
  return outcome;
}

// "Relevant to your case · FIR" for an accepted document.
export const relevanceLabel = (file: PickedFile): string | null =>
  file.relevance
    ? i18n.t('documents:relevance.relevantLabel', { type: file.relevance.documentType })
    : null;
