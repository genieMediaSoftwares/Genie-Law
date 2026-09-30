import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: { email?: string } | undefined;
  VerifyContact: {
    verificationToken: string;
    channels: import('./auth').PendingVerification['channels'];
    email: string;
  };
};

export type ClientTabParamList = {
  Home: undefined;
  Cases: undefined;
  Advocates: { initialSearch?: string } | undefined;
  Profile: undefined;
};

export type ClientStackParamList = {
  Tabs: undefined;
  CaseDetails: { caseId: string; title?: string };
  AdvocateProfile: { userId: string; name?: string };
  Notifications: undefined;
  Favorites: undefined;
  Messages: undefined;
  Chat: { chatId: string; name?: string; avatar?: string };
  Documents: undefined;
  Settings: undefined;
  MyProfileDetail: undefined;
  Appointments: undefined;
  PersonalInformation: undefined;
  RecentActivity: undefined;
  ChangePassword: undefined;
  AboutUs: undefined;
  PrivacyPolicy: undefined;
  TermsConditions: undefined;
  AllCategories: undefined;
  PostCase:
    | {
        start?: 'manual' | 'ai';
        sessionId?: string;
        categoryId?: string;
        // Details already typed elsewhere (e.g. Urgent Help), to start from.
        prefill?: { title?: string; description?: string; location?: string; urgency?: string };
      }
    | undefined;
  AiAssistant: undefined;
  AiSession: { sessionId: string };
  AiChat: { initialQuestion?: string } | undefined;
  Payments: undefined;
  PaymentDetails: { paymentId: string };
  Reviews: undefined;
  Disputes: undefined;
  UrgentHelp: undefined;
};

export type LawyerTabParamList = {
  Workspace: undefined;
  Dashboard: undefined;
  Leads: undefined;
  Clients: { tab?: 'active' | 'inProgress' | 'completed' } | undefined;
  Calendar: undefined;
  LawyerProfile: undefined;
};

export type LawyerStackParamList = {
  Tabs: undefined;
  Hearings: undefined;
  Research: undefined;
  ResearchCases: undefined;
  ResearchDocuments: { caseId: string; caseTitle: string };
  ResearchSession: {
    sessionId?: string;
    title?: string;
    caseId?: string;
    caseTitle?: string;
    caseCategory?: string;
  } | undefined;
  Notes: undefined;
  LawyerMyProfile: undefined;
  LawyerReviews: undefined;
  ProfessionalDetails: undefined;
  Subscription: undefined;
  Checkout: { planId: string };
  Payments: undefined;
  PaymentDetails: { paymentId: string };
  LeadDetails: { caseId: string };
  LawyerClientDetails: { clientId: string; caseId: string };

  Documents: undefined;
  Messages: undefined;
  Chat: { chatId: string; name?: string; avatar?: string };
  Notifications: undefined;
  Settings: undefined;
  ChangePassword: undefined;
  AboutUs: undefined;
  PrivacyPolicy: undefined;
  TermsConditions: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type ClientStackScreenProps<T extends keyof ClientStackParamList> =
  NativeStackScreenProps<ClientStackParamList, T>;

export type ClientTabScreenProps<T extends keyof ClientTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<ClientTabParamList, T>,
    NativeStackScreenProps<ClientStackParamList>
  >;

export type LawyerStackScreenProps<T extends keyof LawyerStackParamList> =
  NativeStackScreenProps<LawyerStackParamList, T>;

export type LawyerTabScreenProps<T extends keyof LawyerTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<LawyerTabParamList, T>,
    NativeStackScreenProps<LawyerStackParamList>
  >;
