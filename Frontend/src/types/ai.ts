export type AiSessionStatus = 'processing' | 'extracted' | 'failed';

export type AiStage =
  | 'queued'
  | 'ocr'
  | 'transcribing'
  | 'extracting'
  | 'classifying'
  | 'completed'
  | 'failed'
  | (string & {});

export interface AiProgress {
  stage: AiStage;
  message: string;
  percent: number;
  current: number | null;
  total: number | null;
  updatedAt: string;
}

export interface AiUploadedDocument {
  documentId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  documentType: string;
  ocrQuality: string;
}

export interface AiParty {
  name: string;
  role: string;
}

export interface AiExtractedData {
  title: string;
  description: string;
  category: string;
  categoryId: string;
  subType: string;
  urgency: string;
  city: string;
  state: string;
  location: string;
  court: string;
  incidentDate: string | null;
  opposingParty: string;
  firNumber: string;
  policeStation: string;
  bailDetails: string;
  claimAmount: number | null;
  documentType: string;
  isCriminalLike: boolean;
  summary: string;
  parties: AiParty[];
  confidence: Record<string, number>;
  needsReview: string[];
}

export interface AiAnalyzeAccepted {
  sessionId: string;
  status: AiSessionStatus;
  progress: AiProgress;
  uploadedDocuments: AiUploadedDocument[];
  documentCount: number;
}

export interface AiSessionDetail {
  sessionId: string;
  status: AiSessionStatus;
  progress: AiProgress;
  extracted: AiExtractedData | null;
  uploadedDocuments: AiUploadedDocument[];
  voiceTranscript: string;
  voiceTranscriptLanguage: string;
  voiceTranscriptSource: 'none' | 'live' | 'server';
  voiceTranscriptionFailed: boolean;
  extractionWarnings: string[];
  failureReason: string;
  session?: unknown;
}

export interface PickedFile {
  uri: string;
  name: string;
  type: string | null;
  size: number | null;
  file?: unknown;
  // Set once a file over the AI limit has been made to fit.
  optimization?: {
    method: 'compressed' | 'optimized';
    originalSize: number;
  };
  // A PDF optimized on the server; sent by reference instead of re-uploaded.
  preparedToken?: string;
  // Set once the AI has accepted the document as relevant to the case.
  relevance?: DocumentRelevance;
}

// The AI's structured verdict on whether a document belongs to the case
// (POST /ai/documents/relevance). Only accepted documents can be submitted:
// the backend requires each one's verificationToken with the case.
export interface DocumentRelevanceResult {
  accepted: boolean;
  relevant: boolean;
  confidence: number;
  documentType: string;
  reason: string;
  caseRelation: string;
  verificationToken: string | null;
}

export type DocumentRelevance = DocumentRelevanceResult & { accepted: true; verificationToken: string };

// What the case is about so far; any field may be empty.
export interface RelevanceContext {
  category?: string;
  subcategory?: string;
  title?: string;
  description?: string;
  summary?: string;
  notes?: string;
  voiceTranscript?: string;
  acceptedDocumentTypes?: string[];
}

export interface ImageCompressionStep {
  maxDimension: number;
  quality: number;
}
