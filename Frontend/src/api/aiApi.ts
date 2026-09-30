import { Platform } from 'react-native';

import { apiClient, unwrap } from './apiClient';
import { env } from '../config/env';
import { formatFileSize } from '../utils/format';
import type { ApiSuccess } from '../types/api';
import type {
  ResearchCase,
  ResearchCaseDocuments,
  ResearchConversation,
  ResearchSession,
} from '../types/lawyer';
import type {
  AiAnalyzeAccepted,
  AiSessionDetail,
  DocumentRelevanceResult,
  PickedFile,
  RelevanceContext,
} from '../types/ai';
import i18n from '../i18n';

export const appendFile = (form: FormData, field: string, file: PickedFile): void => {
  if (Platform.OS === 'web' && file.file) {
    (form.append as (
      name: string,
      value: Blob,
      fileName?: string,
    ) => void)(field, file.file as Blob, file.name);
    return;
  }

  form.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/octet-stream',
  } as unknown as Blob);
};

// Upload progress for React state: forwards only when the whole percentage
// changes. React Native emits a progress event every 100ms during an upload;
// passing each one to setState re-rendered the whole screen ~10x/second for
// the length of the upload, competing with the UI on the JS thread.
const wholePercentProgress = (
  onProgress?: (fraction: number) => void,
): ((event: { loaded: number; total?: number }) => void) | undefined => {
  if (!onProgress) {
    return undefined;
  }
  let lastPercent = -1;
  return event => {
    if (!event.total) {
      return;
    }
    const percent = Math.min(100, Math.floor((event.loaded / event.total) * 100));
    if (percent !== lastPercent) {
      lastPercent = percent;
      onProgress(percent / 100);
    }
  };
};

export interface AnalyzeInput {
  documents: PickedFile[];
  voice?: PickedFile | null;
  issueDescription?: string;
  voiceTranscript?: string;
  voiceLanguage?: string;
  requestId: string;
  onUploadProgress?: (fraction: number) => void;
}

export interface OptimizedDocument {
  token: string;
  name: string;
  mimeType: string;
  size: number;
  originalSize: number;
  optimized: boolean;
}

export interface AiChatInput {
  message: string;
  conversationId?: string;
  mode?: 'chat' | 'research';
}

export interface AiChatMessage {
  role: 'user' | 'model' | 'assistant';
  text: string;
  timestamp?: string;
}

export interface AiChatResponse {
  response: string;
  conversationId?: string;
  title?: string;
  messages?: AiChatMessage[];
}

export const aiApi = {
  async chat(input: AiChatInput): Promise<AiChatResponse> {
    const response = await apiClient.post<ApiSuccess<AiChatResponse>>(
      '/ai/chat',
      {
        message: input.message,
        conversationId: input.conversationId,
        mode: input.mode || 'chat',
      },
    );
    return unwrap(response);
  },

  async getResearchSessions(): Promise<ResearchSession[]> {
    const response = await apiClient.get<
      ApiSuccess<{ conversations: ResearchSession[] }>
    >('/ai/conversations', { params: { mode: 'research' } });
    return unwrap(response)?.conversations ?? [];
  },

  async getConversation(id: string): Promise<{
    id: string;
    title: string;
    messages: AiChatMessage[];
  }> {
    const response = await apiClient.get<
      ApiSuccess<{ conversation: { _id: string; title: string; messages: AiChatMessage[] } }>
    >(`/ai/conversations/${encodeURIComponent(id)}`);
    const conversation = unwrap(response)?.conversation;
    return {
      id: conversation?._id ?? id,
      title: conversation?.title ?? '',
      messages: conversation?.messages ?? [],
    };
  },

  async getResearchConversation(id: string): Promise<ResearchConversation> {
    const response = await apiClient.get<
      ApiSuccess<{ conversation: ResearchConversation }>
    >(`/ai/conversations/${encodeURIComponent(id)}`);
    return unwrap(response).conversation;
  },

  async getResearchCases(search?: string): Promise<ResearchCase[]> {
    const response = await apiClient.get<ApiSuccess<ResearchCase[]>>(
      '/ai/research/cases',
      { params: search ? { search } : undefined },
    );
    return unwrap(response) ?? [];
  },

  async getResearchCaseDocuments(caseId: string): Promise<ResearchCaseDocuments> {
    const response = await apiClient.get<ApiSuccess<ResearchCaseDocuments>>(
      `/ai/research/cases/${encodeURIComponent(caseId)}/documents`,
    );
    return unwrap(response);
  },

  async startCaseResearch(input: {
    caseId: string;
    documentIds: string[];
    question?: string;
    jurisdiction?: string;
  }): Promise<{ conversationId: string }> {
    const response = await apiClient.post<ApiSuccess<{ conversationId: string }>>(
      '/ai/research/sessions',
      input,
    );
    return unwrap(response);
  },

  async searchRelevantCases(
    conversationId: string,
    input: { query?: string; jurisdiction?: string } = {},
  ): Promise<void> {
    await apiClient.post(
      `/ai/research/${encodeURIComponent(conversationId)}/relevant-cases`,
      input,
    );
  },

  async deleteConversation(id: string): Promise<void> {
    await apiClient.delete(`/ai/conversations/${encodeURIComponent(id)}`);
  },

  async transcribe(
    audio: PickedFile,
    language?: string,
  ): Promise<{ transcript: string; language: string }> {
    const form = new FormData();
    appendFile(form, 'audio', audio);
    if (language) {
      form.append('language', language);
    }

    const response = await apiClient.post<
      ApiSuccess<{ transcript: string; language: string }>
    >('/ai/transcribe', form, {
      headers: { 'Content-Type': undefined },
      timeout: 120000,
    });

    return unwrap(response);
  },

  async analyze(input: AnalyzeInput): Promise<AiAnalyzeAccepted> {
    const tooLarge = oversizedDocumentReason(input.documents);
    if (tooLarge) {
      throw new Error(tooLarge);
    }

    const form = new FormData();

    for (const document of input.documents) {
      if (document.preparedToken) {
        form.append('preparedDocuments', document.preparedToken);
      } else {
        appendFile(form, 'documents', document);
      }
    }

    if (input.voice) {
      appendFile(form, 'voice', input.voice);
    }

    if (input.issueDescription?.trim()) {
      form.append('issueDescription', input.issueDescription.trim());
    }
    if (input.voiceTranscript?.trim()) {
      form.append('voiceTranscript', input.voiceTranscript.trim());
    }
    if (input.voiceLanguage) {
      form.append('voiceLanguage', input.voiceLanguage);
    }

    form.append('requestId', input.requestId);

    const response = await apiClient.post<ApiSuccess<AiAnalyzeAccepted>>(
      '/ai/smart-case/analyze',
      form,
      {
        headers: { 'Content-Type': undefined },
        timeout: 180000,
        onUploadProgress: wholePercentProgress(input.onUploadProgress),
      },
    );

    return unwrap(response);
  },

  // Sends a PDF over the AI limit to be shrunk server-side. The result is held on the
  // server and later included in the analysis by its token.
  async optimizePdf(
    file: PickedFile,
    onUploadProgress?: (fraction: number) => void,
  ): Promise<OptimizedDocument> {
    const form = new FormData();
    appendFile(form, 'document', file);

    const response = await apiClient.post<ApiSuccess<OptimizedDocument>>(
      '/ai/smart-case/optimize',
      form,
      {
        headers: { 'Content-Type': undefined },
        timeout: 240000,
        onUploadProgress: wholePercentProgress(onUploadProgress),
      },
    );
    return unwrap(response);
  },

  // Asks the AI whether one document belongs to the case. The server reads it
  // in memory and stores nothing.
  async checkRelevance(
    file: PickedFile,
    context: RelevanceContext,
  ): Promise<DocumentRelevanceResult> {
    const form = new FormData();
    if (file.preparedToken) {
      form.append('preparedToken', file.preparedToken);
    } else {
      appendFile(form, 'document', file);
    }
    for (const [key, value] of Object.entries(context)) {
      if (Array.isArray(value)) {
        value.forEach(item => form.append(key, item));
      } else if (typeof value === 'string' && value.trim()) {
        form.append(key, value.trim());
      }
    }

    const response = await apiClient.post<ApiSuccess<DocumentRelevanceResult>>(
      '/ai/documents/relevance',
      form,
      { headers: { 'Content-Type': undefined }, timeout: 60000 },
    );
    return unwrap(response);
  },

  async getSession(sessionId: string): Promise<AiSessionDetail> {
    const response = await apiClient.get<ApiSuccess<AiSessionDetail>>(
      `/ai/smart-case/session/${encodeURIComponent(sessionId)}`,
    );
    return unwrap(response);
  },

  async getHistory(limit = 20): Promise<unknown[]> {
    const response = await apiClient.get<ApiSuccess<unknown[]>>(
      '/ai/smart-case/history',
      { params: { limit: String(limit) } },
    );
    return unwrap(response) ?? [];
  },

  async linkCase(sessionId: string, caseId: string): Promise<void> {
    await apiClient.post<ApiSuccess<unknown>>(
      `/ai/smart-case/session/${encodeURIComponent(sessionId)}/link-case`,
      { caseId },
    );
  },
};

// Shared constant for all document size checks.
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB = 10,485,760 bytes

export const UPLOAD_LIMITS = {
  maxDocuments: 10,
  maxFileBytes: MAX_DOCUMENT_SIZE,
  documentMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
  ],
  documentExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.txt', '.md', '.csv'],
  audioMimeTypes: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/3gpp',
    'audio/amr',
  ],
} as const;

const MB = 1024 * 1024;

// AI Smart Case Assistant: the largest document accepted, after optimization
// (AI_UPLOAD_MAX_MB). Larger files are optimized first; see services/aiFileOptimizer.
export const aiMaxFileBytes = (): number => Math.floor(env.aiUploadMaxMb * MB);

// The largest original sent to /ai/smart-case/optimize to be shrunk
// (AI_OPTIMIZE_MAX_MB). It is never uploaded as a document itself.
// Never above MAX_DOCUMENT_SIZE: nothing over 10 MB is ever sent.
export const aiOptimizeMaxBytes = (): number =>
  Math.min(Math.max(Math.floor(env.aiOptimizeMaxMb * MB), aiMaxFileBytes()), MAX_DOCUMENT_SIZE);

// Single documents uploaded without optimization (the case acknowledgement).
export const maxAiFileBytes = (): number =>
  Math.min(UPLOAD_LIMITS.maxFileBytes, aiMaxFileBytes());

// Bytes the analysis request itself will carry. PDFs optimized on the server
// are already there and travel only as a token.
export const knownTotalBytes = (files: ReadonlyArray<PickedFile | null | undefined>): number =>
  files.reduce((sum, file) => sum + (file && !file.preparedToken ? file.size ?? 0 : 0), 0);

// Last guard before sending: an original over the limit must never be uploaded.
export const oversizedDocumentReason = (
  documents: ReadonlyArray<PickedFile>,
): string | null => {
  const max = aiMaxFileBytes();
  const oversized = documents.find(
    file => !file.preparedToken && file.size !== null && file.size > max,
  );
  return oversized
    ? i18n.t('documents:files.overLimitRemove', {
        name: oversized.name,
        size: formatFileSize(oversized.size),
        limit: formatFileSize(max),
      })
    : null;
};

export const rejectionReasonFor = (file: PickedFile): string | null => {
  const maxBytes = maxAiFileBytes();
  if (file.size !== null && file.size > maxBytes) {
    return i18n.t('documents:files.overLimitReduce', {
      name: file.name,
      size: formatFileSize(file.size),
      limit: formatFileSize(maxBytes),
    });
  }

  return unsupportedTypeReason(file);
};

export const unsupportedTypeReason = (file: PickedFile): string | null => {
  const name = file.name.toLowerCase();

  if (name.endsWith('.doc')) {
    return i18n.t('documents:files.oldDoc', { name: file.name });
  }

  const extensionAllowed = UPLOAD_LIMITS.documentExtensions.some(extension =>
    name.endsWith(extension),
  );
  const mimeAllowed =
    file.type !== null &&
    (UPLOAD_LIMITS.documentMimeTypes as readonly string[]).includes(file.type);

  if (!extensionAllowed && !mimeAllowed) {
    return i18n.t('documents:files.unsupported', { name: file.name });
  }

  return null;
};
