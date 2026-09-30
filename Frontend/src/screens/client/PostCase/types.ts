import type {
  AiParty,
  AiUploadedDocument,
  PickedFile,
  RelevanceContext,
} from '../../../types/ai';
import type { CreateCasePayload, RecommendedLawyer } from '../../../types/domain';
import { categoryById, categoryByTitle } from '../../../services/legalCategories';
import type { AiExtractedData } from '../../../types/ai';
import i18n from '../../../i18n';

// A document chosen for the case. It exists only on this device until the
// client presses "Submit Case", which uploads it together with the case
// (casesApi.submit). Nothing is stored on the server before that.
export interface PendingDocument {
  id: string;
  name: string;
  size: number | null;
  mimeType: string;
  file: PickedFile;
  status: 'pending';
}

let pendingSequence = 0;

export const toPendingDocument = (file: PickedFile): PendingDocument => {
  pendingSequence += 1;
  return {
    id: `pending-${Date.now().toString(36)}-${pendingSequence}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    file,
    status: 'pending',
  };
};

export interface PostCaseState {
  categoryId: string;
  category: string;
  subcategory: string;

  title: string;
  description: string;
  location: string;
  preferredCourt: string;
  urgency: string;

  state: string;
  incidentDate: string | null;
  opposingParty: string;
  firNumber: string;
  policeStation: string;
  bailDetails: string;
  claimAmount: number | null;
  voiceTranscript: string;

  entryMode: EntryMode | null;
  // The manually chosen acknowledgement document.
  document: PendingDocument | null;
  // The documents the AI assistant read; submitted with the case.
  aiFiles: PendingDocument[];
  // True while a chosen document is being checked for relevance.
  documentsVerifying: boolean;
  // What the assistant reported about each document it read (readability).
  aiDocuments: AiUploadedDocument[];

  aiSessionId: string | null;
  aiFields: string[];
  aiNeedsReview: string[];
  aiWarnings: string[];
  aiSummary: string;
  aiParties: AiParty[];
  aiFullDescription: string;

  selectedLawyers: RecommendedLawyer[];
}

export type EntryMode = 'manual' | 'ai';

export const REQUIRED_LAWYER_COUNT = 3;

export type LawyerSelectionResult =
  | { ok: true; selected: RecommendedLawyer[] }
  | { ok: false; selected: RecommendedLawyer[]; reason: string };

export const toggleLawyer = (
  selected: RecommendedLawyer[],
  lawyer: RecommendedLawyer,
): LawyerSelectionResult => {
  if (selected.some(item => item.userId === lawyer.userId)) {
    return {
      ok: true,
      selected: selected.filter(item => item.userId !== lawyer.userId),
    };
  }

  if (selected.length >= REQUIRED_LAWYER_COUNT) {
    return {
      ok: false,
      selected,
      reason: i18n.t('client:postCase.maxLawyers', { count: REQUIRED_LAWYER_COUNT }),
    };
  }

  return { ok: true, selected: [...selected, lawyer] };
};

const SHORT_DESCRIPTION_CHARS = 320;

export const shortenDescription = (value: string): string => {
  const text = value.replace(/\s+/g, ' ').trim();

  if (text.length <= SHORT_DESCRIPTION_CHARS) {
    return text;
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) {
    return text;
  }

  let out = '';
  for (const sentence of sentences) {
    const piece = sentence.trim();
    const next = out ? `${out} ${piece}` : piece;

    if (out && next.length > SHORT_DESCRIPTION_CHARS) {
      break;
    }
    out = next;
  }

  return out || text;
};

export const initialPostCaseState: PostCaseState = {
  categoryId: '',
  category: '',
  subcategory: '',

  title: '',
  description: '',
  location: '',
  preferredCourt: '',
  urgency: '',

  state: '',
  incidentDate: null,
  opposingParty: '',
  firNumber: '',
  policeStation: '',
  bailDetails: '',
  claimAmount: null,
  voiceTranscript: '',

  entryMode: null,
  document: null,
  aiFiles: [],
  documentsVerifying: false,
  aiDocuments: [],

  aiSessionId: null,
  aiFields: [],
  aiNeedsReview: [],
  aiWarnings: [],
  aiSummary: '',
  aiParties: [],
  aiFullDescription: '',

  selectedLawyers: [],
};

export const POST_CASE_STEPS = [
  'Category',
  'Details',
  'Documents',
  'Lawyers',
  'Review',
] as const;

export type PostCaseStepIndex = 0 | 1 | 2 | 3 | 4;

export const applyExtraction = (
  current: PostCaseState,
  extracted: AiExtractedData,
  documents: AiUploadedDocument[],
  sessionId: string,
  voiceTranscript: string,
  warnings: string[],
): PostCaseState => {
  const filled: string[] = [];

  const take = (value: string, key: string, existing: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return existing;
    }
    filled.push(key);
    return trimmed;
  };

  const resolved =
    categoryByTitle(extracted.category) || categoryById(extracted.categoryId);

  const category = resolved ? resolved.title : current.category;
  const categoryId = resolved ? resolved.id : current.categoryId;
  if (resolved) {
    filled.push('category');
  }

  const subType = (extracted.subType || '').trim();
  const subcategory =
    resolved && subType
      ? resolved.subTypes.find(
          s => s.toLowerCase() === subType.toLowerCase(),
        ) ?? current.subcategory
      : current.subcategory;
  if (subcategory && subcategory !== current.subcategory) {
    filled.push('subcategory');
  }

  const claimAmount =
    typeof extracted.claimAmount === 'number' && extracted.claimAmount > 0
      ? extracted.claimAmount
      : current.claimAmount;
  if (claimAmount !== current.claimAmount) {
    filled.push('claimAmount');
  }

  const incidentDate = extracted.incidentDate || current.incidentDate;
  if (incidentDate !== current.incidentDate) {
    filled.push('incidentDate');
  }

  const rawDescription = (extracted.description || '').trim();
  const shortDescription = shortenDescription(rawDescription);
  const wasShortened =
    Boolean(rawDescription) && shortDescription !== rawDescription;

  return {
    ...current,
    categoryId,
    category,
    subcategory,

    title: take(extracted.title, 'title', current.title),
    description: take(shortDescription, 'description', current.description),
    location: take(
      extracted.city || extracted.location,
      'location',
      current.location,
    ),
    preferredCourt: take(extracted.court, 'preferredCourt', current.preferredCourt),
    urgency: take(extracted.urgency, 'urgency', current.urgency),

    state: take(extracted.state, 'state', current.state),
    incidentDate,
    opposingParty: take(
      extracted.opposingParty,
      'opposingParty',
      current.opposingParty,
    ),
    firNumber: take(extracted.firNumber, 'firNumber', current.firNumber),
    policeStation: take(
      extracted.policeStation,
      'policeStation',
      current.policeStation,
    ),
    bailDetails: take(extracted.bailDetails, 'bailDetails', current.bailDetails),
    claimAmount,
    voiceTranscript: voiceTranscript || current.voiceTranscript,

    entryMode: 'ai',
    aiDocuments: documents,
    aiSessionId: sessionId,
    aiFields: Array.from(new Set(filled)),
    aiNeedsReview: extracted.needsReview ?? [],
    aiWarnings: warnings ?? [],
    aiSummary: (extracted.summary || '').trim(),
    aiParties: extracted.parties ?? [],
    aiFullDescription: wasShortened ? rawDescription : '',
  };
};

export const toCreatePayload = (
  state: PostCaseState,
  clientRequestId?: string,
): CreateCasePayload => {
  const title =
    state.title.trim() || state.subcategory.trim() || state.category.trim();

  return {
    title,
    description: state.description.trim(),
    category: state.category,
    subcategory: state.subcategory || undefined,
    location: state.location.trim(),
    urgency: state.urgency || undefined,
    preferredCourt: state.preferredCourt.trim() || undefined,
    selectedLawyers: state.selectedLawyers.map(lawyer => lawyer.userId),
    clientRequestId,
    voiceTranscript: state.voiceTranscript || undefined,
    city: state.location.trim() || undefined,
    state: state.state.trim() || undefined,
    incidentDate: state.incidentDate || undefined,
    opposingParty: state.opposingParty.trim() || undefined,
    firNumber: state.firNumber.trim() || undefined,
    policeStation: state.policeStation.trim() || undefined,
    bailDetails: state.bailDetails.trim() || undefined,
    claimAmount: state.claimAmount ?? undefined,
    aiSessionId: state.aiSessionId || undefined,
  };
};

// What the relevance check knows about the case so far.
export const relevanceContextOf = (state: PostCaseState): RelevanceContext => ({
  category: state.category,
  subcategory: state.subcategory,
  title: state.title,
  description: state.description,
  summary: state.aiSummary,
  voiceTranscript: state.voiceTranscript,
  acceptedDocumentTypes: documentsToSubmit(state)
    .map(document => document.file.relevance?.documentType ?? '')
    .filter(Boolean),
});

// Every document that "Submit Case" uploads, in display order.
export const documentsToSubmit = (state: PostCaseState): PendingDocument[] => [
  ...(state.document ? [state.document] : []),
  ...state.aiFiles,
];

export const isStepComplete = (
  state: PostCaseState,
  step: PostCaseStepIndex,
): boolean => {
  switch (step) {
    case 0:
      return Boolean(
        state.category && (state.subcategory || state.aiSessionId),
      );
    case 1:
      return Boolean(state.description.trim() && state.location.trim());
    case 2:
      return !state.documentsVerifying && documentsToSubmit(state).length > 0;
    case 3:
      return state.selectedLawyers.length === REQUIRED_LAWYER_COUNT;
    case 4:
      return true;
    default:
      return false;
  }
};
