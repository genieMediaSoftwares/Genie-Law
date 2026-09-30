import type {
  AppDocument,
  LawyerRequestStatus,
  LegalCase,
  PopulatedUser,
} from './domain';

export interface LawyerLead {
  caseId: string;
  clientName: string;
  clientProfileImage?: string;
  clientLocation?: string;
  issueCategory: string;
  issueTitle: string;
  location: string;
  postedTime: string;
  urgency: string;
  documentsCount?: number;
  acknowledgementDocument: string;
  preferredCourt: string;
  caseStatus: string;
  matchPercentage?: number | null;
  requestStatus?: LawyerRequestStatus;
  unavailableReason?: string | null;
}

export const isActionableLead = (lead: LawyerLead): boolean =>
  (lead.requestStatus ?? 'Pending') === 'Pending';

export interface LawyerClientRow {
  clientId: string;
  name: string;
  profileImage: string;
  caseId: string;
  issue: string;
  category?: string;
  location?: string;
  preferredCourt?: string;
  urgency?: string;
  currentStatus: string;
  acceptedAt?: string | null;
  lastActivity: string;
  tasksRemaining?: number;
}

// GET /clients/:id — only returned to a lawyer acting for this client.
export interface LawyerClientDetail {
  client: Pick<PopulatedUser, '_id' | 'fullName' | 'profileImage'> &
    Partial<Pick<PopulatedUser, 'email' | 'mobile' | 'location'>>;
  caseHistory: LegalCase[];
  documents: AppDocument[];
}

export interface LawyerClientGroups {
  accepted: LawyerClientRow[];
  inProgress: LawyerClientRow[];
  closed: LawyerClientRow[];
}

export type ScheduleEventType =
  | 'consultation'
  | 'hearing'
  | 'meeting'
  | 'reminder';

export interface LawyerScheduleEvent {
  title: string;
  client: string;
  case: string;
  startTime: string;
  endTime: string;
  eventType: ScheduleEventType;
}

export interface LawyerUnreadMessages {
  unreadCount: number;
  conversationCount: number;
  latestMessage: string;
  latestClient: string;
  lastMessageTime: string | null;
}

export type LawyerVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface LawyerProfileDetail {
  _id: string;
  user: PopulatedUser;
  specialization: string;
  experience: number;
  education: string;
  barCouncilNumber: string;
  languages: string[];
  consultationFee: number;
  bio: string;
  officeAddress: string;
  rating: number;
  totalReviews: number;
  verificationStatus: LawyerVerificationStatus;
  subscriptionPlan: string;
  workingHours: string;
  casesHandled: number;
  winPercentage: number;
  responseTime: string;
  district: string;
  practiceAreas: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LawyerProfileUpdate {
  specialization?: string;
  experience?: number;
  education?: string;
  barCouncilNumber?: string;
  consultationFee?: number;
  bio?: string;
  officeAddress?: string;
  workingHours?: string;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface Appointment {
  _id: string;
  client: PopulatedUser | null;
  lawyer: PopulatedUser | null;
  case: { _id: string; title: string; category: string } | null;
  date: string;
  timeSlot: string;
  mode: 'Chat' | 'In-Person';
  status: AppointmentStatus;
  meetingLink: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LawyerHearing {
  _id?: string;
  date: string;
  timeSlot?: string;
  court?: string;
  purpose?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  caseId: string;
  caseTitle: string;
  caseCategory: string;
  caseStatus: string;
  clientId: string | null;
  clientName: string;
  clientImage: string;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  // Null on the free tier: nothing was bought, so there are no dates.
  startDate: string | null;
  endDate: string | null;
}

export interface LawyerNote {
  _id: string;
  title: string;
  text: string;
  case: string | null;
  lawyer: { _id: string; fullName?: string; profileImage?: string } | string;
  date: string;
  updatedAt: string;
}

export interface LawyerNoteRow extends LawyerNote {
  clientId: string;
  clientName: string;
}

export interface LawyerNoteInput {
  text: string;
  title?: string;
  caseId?: string | null;
}

export type HearingStatus =
  | 'scheduled'
  | 'completed'
  | 'adjourned'
  | 'cancelled';

export interface HearingInput {
  date: string;
  timeSlot?: string;
  court?: string;
  purpose?: string;
  status?: HearingStatus;
  notes?: string;
}

export interface ResearchSession {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ResearchCase {
  caseId: string;
  title: string;
  category: string;
  subcategory: string;
  clientName: string;
  court: string;
  location: string;
  status: string;
  updatedAt: string;
  documentCount: number;
}

export interface ResearchCaseDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  status: 'available' | 'unsupported' | 'missing';
  selectable: boolean;
  note: string;
}

export interface ResearchCaseDocuments {
  case: {
    caseId: string;
    title: string;
    category: string;
    clientName: string;
    court: string;
    status: string;
  };
  documents: ResearchCaseDocument[];
}

export interface ResearchDocumentUse {
  documentId: string;
  name: string;
  reference: string;
  status: 'pending' | 'used' | 'truncated' | 'failed' | 'unsupported' | 'missing';
  charCount: number;
  note: string;
}

export type RelevantCaseVerification =
  | 'Source Retrieved'
  | 'Search Result — Not Yet Verified';

export interface RelevantCase {
  caseTitle: string;
  citation: string;
  court: string;
  jurisdiction: string;
  decisionDate: string;
  relevanceSummary: string;
  legalPrinciple: string;
  sources: { url: string; name: string }[];
  verificationStatus: RelevantCaseVerification;
  retrievedAt: string;
}

export interface RelevantCasesState {
  status: 'idle' | 'searching' | 'completed' | 'failed' | 'unavailable';
  query: string;
  jurisdiction: string;
  searchedAt: string | null;
  message: string;
  results: RelevantCase[];
}

export interface ResearchConversation {
  id: string;
  title: string;
  messages: { role: 'user' | 'model' | 'assistant'; text: string; timestamp?: string }[];
  caseId: string | null;
  caseTitle: string;
  jurisdiction: string;
  researchDocuments: ResearchDocumentUse[];
  researchStatus: 'idle' | 'processing' | 'completed' | 'failed';
  researchStage: string;
  researchError: string;
  relevantCases: RelevantCasesState;
}
