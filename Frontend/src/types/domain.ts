import type { PaymentState } from './payments';
import type { UserRole } from './auth';

export interface PopulatedUser {
  _id: string;
  fullName: string;
  email: string;
  mobile: string;
  profileImage: string;
  location?: string;
  isVerified?: boolean;
  isActive?: boolean;
  role?: UserRole;
}

export const CASE_STATUSES = [
  'Submitted',
  'Awaiting Lawyer Acceptance',
  'Pending Lawyer Response',
  'Interested',
  'Accepted',
  'In Progress',
  'Completed',
  'Closed',
  'Rejected',
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface CaseDocument {
  name: string;
  url: string;
  size: string;
}

export interface CaseMilestone {
  _id?: string;
  title: string;
  date: string;
  isCompleted: boolean;
}

export type HearingStatus =
  | 'scheduled'
  | 'completed'
  | 'adjourned'
  | 'cancelled';

export interface CaseHearing {
  _id: string;
  date: string;
  timeSlot: string;
  court: string;
  purpose: string;
  status: HearingStatus;
  notes: string;
  createdAt: string;
}

export interface CaseProposal {
  _id?: string;
  lawyer: PopulatedUser | null;
  feeProposal: number;
  message: string;
  createdAt: string;
}

export type LawyerRequestStatus =
  | 'Pending'
  | 'Accepted'
  | 'Declined'
  | 'Unavailable';

export interface CaseLawyerRequest {
  lawyer: PopulatedUser | string;
  status: LawyerRequestStatus;
  createdAt: string;
  respondedAt: string | null;
  acceptedAt: string | null;
}

export interface LegalCase {
  _id: string;
  client: PopulatedUser | string;
  title: string;
  description: string;
  category: string;
  subcategory: string;

  location: string;
  locationCity: string;
  locationDistrict: string;
  locationState: string;
  locationCountry: string;
  locationPlaceId: string;
  locationLatitude: number;
  locationLongitude: number;

  preferredCourt: string;

  incidentDate: string | null;
  opposingParty: string;
  firNumber: string;
  policeStation: string;
  bailDetails: string;

  budgetRange: string;
  urgency: string;
  status: CaseStatus;

  documents: CaseDocument[];
  proposals: CaseProposal[];

  selectedLawyer: PopulatedUser | null;
  assignedLawyer: PopulatedUser | null;
  selectedLawyerProfile?: LawyerProfile | null;
  assignedLawyerProfile?: LawyerProfile | null;
  lawyerRequests?: CaseLawyerRequest[];
  myRequestStatus?: LawyerRequestStatus | null;

  milestones: CaseMilestone[];
  hearings: CaseHearing[];

  caseOutcome: string;
  claimAmount: string;
  consultationDate: string | null;
  nextHearing: string | null;
  closedDate: string | null;

  rating: number;
  review: string;

  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;

  voiceUrl: string;
  voiceTranscript: string;

  createdAt: string;
  updatedAt: string;
}

export interface LawyerProfile {
  _id: string;
  user: PopulatedUser | null;
  specialization: string;
  experience: number;
  education: string;
  barCouncilNumber: string;
  languages: string[];
  consultationFee: number;
  bio: string;
  officeAddress: string;
  availability?: string[];
  rating: number;
  totalReviews: number;
  verificationStatus?: string;
  workingHours?: string;
  casesHandled?: number;
  winPercentage?: number;
  responseTime?: string;
  district?: string;
  practiceAreas?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RecommendedLawyer {
  lawyerId: string;
  userId: string;
  fullName: string;
  profileImage: string;
  specialization: string;
  city: string;
  district: string;
  state: string;
  location: string;
  experience: number;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  languages: string[];
  practiceAreas: string[];
  verified: boolean;
  onlineStatus: boolean;
  responseTime: string;
  matchPercentage: number;
  casesHandled: number;
  winPercentage: number;
  locationScore: number;
  bio: string;
  education: string;
  barCouncilNumber: string;
  officeAddress: string;
  workingHours: string;
}

export interface CreateCasePayload {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  location: string;
  budgetRange?: string;
  urgency?: string;
  preferredCourt?: string;
  // Case documents are never sent as URLs: they are uploaded with the
  // submission itself (casesApi.submit).
  selectedLawyers: string[];
  clientRequestId?: string;
  voiceUrl?: string;
  voiceTranscript?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;

  incidentDate?: string | null;
  opposingParty?: string;
  firNumber?: string;
  policeStation?: string;
  bailDetails?: string;
  claimAmount?: number | null;
  // The AI Smart Case session that drafted this case, linked on submission.
  aiSessionId?: string;
}

export interface FavoriteEntry {
  _id: string;
  lawyer: PopulatedUser | null;
  profile: LawyerProfile | null;
}

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface AppNotification {
  _id: string;
  notificationId?: string;
  senderId: Pick<PopulatedUser, '_id' | 'fullName' | 'profileImage'> & {
    role?: UserRole;
  } | null;
  receiverId: string;
  title: string;
  message: string;
  type: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface PageInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface NotificationPage {
  notifications: AppNotification[];
  pagination: PageInfo;
  unreadCount: number;
}

export interface ClientProfileDoc {
  _id: string;
  user: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ClientProfileResponse {
  user: ProfileUserDoc;
  profile: ClientProfileDoc;
}

export interface ProfileUserDoc {
  _id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  profileImage: string;
  location: string;
  dob: string;
  gender: string;
  languages: string[];
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStats {
  activeCases: number;
  totalCases: number;
  totalAppointments: number;
  totalDocuments: number;
}

export interface MessageAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface ChatMessage {
  _id: string;
  chat: string;
  sender: PopulatedUser | string;
  content: string;
  attachments?: MessageAttachment[];
  clientId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  _id: string;
  participants: (PopulatedUser & { specialization?: string })[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSender?: string;
  unreadCount?: number;
  caseInfo?: {
    id: string;
    title: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppDocument {
  _id: string;
  clientId: string;
  issueId?: string | null;
  originalName: string;
  name?: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

// A review written by a client about a lawyer (backend Review model).
export interface LawyerReview {
  _id: string;
  lawyer: string | PopulatedUser;
  client: PopulatedUser | string | null;
  rating: number;
  review: string;
  reply?: string;
  replyDate?: string | null;
  isHidden?: boolean;
  isReported?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Backend Issue model used for client-lawyer disputes.
export interface Issue {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: 'Pending' | 'Assigned' | 'Resolved' | 'Closed';
  urgency?: string;
  preferredMode?: string;
  location?: string;
  preferredLanguage?: string;
  documents?: Array<{ name: string; url: string; size?: string; path?: string }>;
  images?: Array<{ name: string; url: string; size?: string }>;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  _id: string;
  amount: number;
  currency: string;
  // Stored status; `state` is the backend's PaymentState for it.
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'expired';
  state: PaymentState;
  purpose: 'consultation' | 'subscription';
  paymentMethod: string;
  appointment?: string | null;
  case?: string | null;
  lawyer?: { fullName: string; email: string };
  client?: { fullName: string; email: string };
  subscriptionPlan?: string;
  gateway?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
