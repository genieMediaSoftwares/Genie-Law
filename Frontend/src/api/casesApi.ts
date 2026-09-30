import axios from 'axios';
import { apiClient, unwrap } from './apiClient';
import { appendFile } from './aiApi';
import { isOwnUpload, resolveFileUrl } from '../utils/urls';
import type { ApiSuccess } from '../types/api';
import type { PickedFile } from '../types/ai';
import type { DocxPreviewResult } from './documentsApi';
import type { CaseHearing, CreateCasePayload, LegalCase } from '../types/domain';
import i18n from '../i18n';

export interface SubmitCaseInput {
  payload: CreateCasePayload;
  documents: PickedFile[];
  onUploadProgress?: (fraction: number) => void;
}

export const casesApi = {
  // "Submit Case": the case details and every chosen document in one request.
  // This is the only call that stores case documents on the server; the
  // backend commits the case and its documents together or not at all.
  async submit({ payload, documents, onUploadProgress }: SubmitCaseInput): Promise<LegalCase> {
    // A multipart body can be sent only once, so each attempt builds its own.
    const buildForm = () => {
      const form = new FormData();
      form.append('case', JSON.stringify(payload));
      for (const document of documents) {
        // The backend accepts only documents the relevance check approved.
        if (document.relevance?.verificationToken) {
          form.append('documentVerifications', document.relevance.verificationToken);
        }
        if (document.preparedToken) {
          // A PDF the server optimized for the AI assistant is held there
          // temporarily; it is committed by reference instead of re-uploaded.
          form.append('preparedDocuments', document.preparedToken);
        } else {
          appendFile(form, 'documents', document);
        }
      }
      return form;
    };

    const send = () =>
      apiClient.post<ApiSuccess<LegalCase>>('/cases/submit', buildForm(), {
        headers: { 'Content-Type': undefined },
        timeout: 180000,
        onUploadProgress: onUploadProgress
          ? event => {
              if (event.total) {
                onUploadProgress(Math.min(1, event.loaded / event.total));
              }
            }
          : undefined,
      });

    // On Android the first request after the app has been idle can go out on
    // a connection the server already closed, and a streamed upload cannot be
    // replayed, so it fails with a network error before reaching the server.
    // Resend (up to twice) only when NO response arrived. This is safe: the
    // payload's clientRequestId makes the backend return the same case for a
    // repeat instead of creating a second one.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return unwrap(await send());
      } catch (error) {
        lastError = error;
        const noResponse =
          axios.isAxiosError(error) && !error.response && error.code === 'ERR_NETWORK';
        if (!noResponse) {
          throw error;
        }
        onUploadProgress?.(0);
        await new Promise<void>(resolve => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastError;
  },

  async create(payload: CreateCasePayload): Promise<LegalCase> {
    const response = await apiClient.post<ApiSuccess<LegalCase>>(
      '/cases',
      payload,
    );
    return unwrap(response);
  },

  async list(): Promise<LegalCase[]> {
    const response = await apiClient.get<ApiSuccess<LegalCase[]>>('/cases');
    return unwrap(response) ?? [];
  },

  async listInProgress(): Promise<LegalCase[]> {
    const response = await apiClient.get<ApiSuccess<LegalCase[]>>(
      '/cases/status/in-progress',
    );
    return unwrap(response) ?? [];
  },

  async listClosed(): Promise<LegalCase[]> {
    const response = await apiClient.get<ApiSuccess<LegalCase[]>>(
      '/cases/status/closed',
    );
    return unwrap(response) ?? [];
  },

  async getById(id: string): Promise<LegalCase> {
    const response = await apiClient.get<ApiSuccess<LegalCase>>(
      `/cases/${encodeURIComponent(id)}`,
    );
    return unwrap(response);
  },

  // Case attachments live under /uploads, guarded by the same session token.
  // The token is only ever sent to this backend's own /uploads path.
  async fetchAttachment(url: string): Promise<Blob> {
    const resolved = resolveFileUrl(url);
    if (!resolved || !isOwnUpload(resolved)) {
      throw new Error(i18n.t('documents:files.cannotOpenInApp'));
    }
    const response = await apiClient.get<Blob>(resolved, {
      responseType: 'blob',
    });
    return response.data;
  },

  // The text of a .docx case attachment, for reading it in the app.
  async fetchAttachmentPreview(url: string): Promise<DocxPreviewResult> {
    const resolved = resolveFileUrl(url);
    if (!resolved || !isOwnUpload(resolved)) {
      throw new Error(i18n.t('documents:files.cannotOpenInApp'));
    }
    const response = await apiClient.get<ApiSuccess<DocxPreviewResult>>(resolved, {
      params: { preview: 'docx' },
    });
    return unwrap(response);
  },

  async getTimeline(id: string): Promise<unknown> {
    const response = await apiClient.get<ApiSuccess<unknown>>(
      `/cases/${encodeURIComponent(id)}/timeline`,
    );
    return unwrap(response);
  },

  async getMyHearings(): Promise<CaseHearing[]> {
    const response = await apiClient.get<ApiSuccess<CaseHearing[]>>(
      '/cases/hearings/mine',
    );
    return unwrap(response) ?? [];
  },
};
