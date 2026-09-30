// Test-only fixtures, typed against the app's backend contracts
// (src/types). They exist only inside tests; production code never sees them.
import type {
  AppNotification,
  ChatMessage,
  LegalCase,
  NotificationPage,
  PopulatedUser,
} from '../types/domain';
import type { LegalCategory } from '../services/legalCategories';

export const categoriesFixture: LegalCategory[] = [
  {
    id: 'property_land',
    title: 'Property & Land',
    slug: 'property-land',
    subTypes: ['Land Dispute', 'Title Verification', 'Tenant Eviction'],
  },
  {
    id: 'family_divorce',
    title: 'Family & Divorce',
    slug: 'family-divorce',
    subTypes: ['Mutual Divorce', 'Child Custody', 'Maintenance'],
  },
];

export const userFixture = (overrides: Partial<PopulatedUser> = {}): PopulatedUser => ({
  _id: '6650f0c2a1b2c3d4e5f60718',
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  mobile: '9876543210',
  profileImage: '',
  ...overrides,
});

export const caseFixture = (overrides: Partial<LegalCase> = {}): LegalCase => ({
  _id: '6651a3b4c5d6e7f809112233',
  client: '6650f0c2a1b2c3d4e5f60718',
  title: 'Boundary wall dispute with neighbour',
  description: 'The neighbour built a wall two feet into our plot.',
  category: 'Property & Land',
  subcategory: 'Land Dispute',
  location: 'Hyderabad, Telangana',
  locationCity: 'Hyderabad',
  locationDistrict: 'Hyderabad',
  locationState: 'Telangana',
  locationCountry: 'India',
  locationPlaceId: '',
  locationLatitude: 0,
  locationLongitude: 0,
  preferredCourt: '',
  incidentDate: null,
  opposingParty: '',
  firNumber: '',
  policeStation: '',
  bailDetails: '',
  budgetRange: '',
  urgency: 'Medium',
  status: 'Submitted',
  documents: [],
  proposals: [],
  selectedLawyer: null,
  assignedLawyer: null,
  milestones: [],
  hearings: [],
  caseOutcome: '',
  claimAmount: '',
  consultationDate: null,
  nextHearing: null,
  closedDate: null,
  rating: 0,
  review: '',
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
  voiceUrl: '',
  voiceTranscript: '',
  createdAt: '2026-09-28T09:30:00.000Z',
  updatedAt: '2026-09-28T09:30:00.000Z',
  ...overrides,
});

export const notificationFixture = (
  overrides: Partial<AppNotification> = {},
): AppNotification => ({
  _id: '6652b1c2d3e4f50617283940',
  senderId: null,
  receiverId: '6650f0c2a1b2c3d4e5f60718',
  title: 'Advocate accepted your case',
  message: 'Adv. Ravi Kumar accepted "Boundary wall dispute with neighbour".',
  type: 'case_accepted',
  priority: 'medium',
  isRead: false,
  createdAt: '2026-09-29T11:00:00.000Z',
  ...overrides,
});

export const notificationPageFixture = (
  notifications: AppNotification[],
  unreadCount = notifications.filter(n => !n.isRead).length,
): NotificationPage => ({
  notifications,
  pagination: { total: notifications.length, page: 1, limit: 15, pages: 1 },
  unreadCount,
});

export const messageFixture = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  _id: '6653c1d2e3f4a50617283941',
  chat: '6653a0b1c2d3e4f506172839',
  sender: userFixture(),
  content: 'Can we meet on Friday?',
  attachments: [],
  isRead: false,
  createdAt: '2026-09-29T12:00:00.000Z',
  updatedAt: '2026-09-29T12:00:00.000Z',
  ...overrides,
});

export const ok = (data: unknown) => ({
  status: 200,
  data: { success: true, message: 'OK', data },
});
