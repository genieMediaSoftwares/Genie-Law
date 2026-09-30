// Matches the backend LegalDocument / LegalAcceptance models.
export type LegalDocumentType =
  | 'platform_terms'
  | 'client_terms'
  | 'lawyer_terms'
  | 'privacy_policy'
  | 'refund_policy'
  | 'ai_disclaimer'
  | 'communication_consent'
  | 'document_sharing_consent';

export interface LegalDocument {
  _id: string;
  type: LegalDocumentType;
  version: string;
  title: string;
  content: string;
  effectiveDate: string;
  audience: 'all' | 'client' | 'lawyer';
  requiresAcceptance: boolean;
  // False until the operator marks the text as reviewed by counsel.
  legallyReviewed: boolean;
  updatedAt: string;
}

export interface LegalAcceptance {
  _id: string;
  documentType: LegalDocumentType;
  version: string;
  acceptedAt: string;
  appVersion?: string;
}
