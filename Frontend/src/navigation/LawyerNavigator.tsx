import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';

import { GenieDrawer, LawyerBottomNavigation } from '../components/navigation';
import { ProfileImageViewer } from '../components/ui/ProfileImageViewer';
import { LegalAcceptanceGate } from '../components/legal';
import {
  BellIcon,
  ChatIcon,
  FileIcon,
  ScalesIcon,
  SettingsIcon,
  StarIcon,
} from '../components/icons/ClientIcons';
import { UserIcon } from '../components/icons/Icons';
import {
  CalendarIcon,
  ChartIcon,
  GridIcon,
  UserPlusIcon,
  UsersIcon,
} from '../components/icons/LawyerIcons';

import { WorkspaceScreen } from '../screens/lawyer/Workspace/WorkspaceScreen';
import { LawyerDashboardScreen } from '../screens/lawyer/Dashboard/LawyerDashboardScreen';
import { LeadsScreen } from '../screens/lawyer/Leads/LeadsScreen';
import { LeadDetailsScreen } from '../screens/lawyer/Leads/LeadDetailsScreen';
import { LawyerClientsScreen } from '../screens/lawyer/Clients/LawyerClientsScreen';
import { LawyerClientDetailsScreen } from '../screens/lawyer/Clients/LawyerClientDetailsScreen';
import { CalendarScreen } from '../screens/lawyer/Calendar/CalendarScreen';
import { LawyerProfileScreen } from '../screens/lawyer/Profile/LawyerProfileScreen';
import { HearingsScreen } from '../screens/lawyer/Hearings/HearingsScreen';
import { ResearchScreen } from '../screens/lawyer/Research/ResearchScreen';
import { ResearchSessionScreen } from '../screens/lawyer/Research/ResearchSessionScreen';
import { ResearchCasesScreen } from '../screens/lawyer/Research/ResearchCasesScreen';
import { ResearchDocumentsScreen } from '../screens/lawyer/Research/ResearchDocumentsScreen';
import { NotesScreen } from '../screens/lawyer/Notes/NotesScreen';
import { LawyerMyProfileScreen } from '../screens/lawyer/Profile/LawyerMyProfileScreen';
import { LawyerReviewsScreen } from '../screens/lawyer/Reviews/LawyerReviewsScreen';
import { ProfessionalDetailsScreen } from '../screens/lawyer/Profile/ProfessionalDetailsScreen';
import { SubscriptionScreen } from '../screens/lawyer/Subscription/SubscriptionScreen';
import { CheckoutScreen } from '../screens/payments/CheckoutScreen';
import { PaymentDetailsScreen } from '../screens/payments/PaymentDetailsScreen';
import { PaymentsScreen } from '../screens/client/Payments/PaymentsScreen';

import { DocumentsScreen } from '../screens/client/Documents/DocumentsScreen';
import { MessagesScreen } from '../screens/client/Messages/MessagesScreen';
import { ChatScreen } from '../screens/client/Messages/ChatScreen';
import { NotificationsScreen } from '../screens/client/Notifications/NotificationsScreen';
import { SettingsScreen } from '../screens/client/Settings/SettingsScreen';
import { ChangePasswordScreen } from '../screens/client/Settings/ChangePasswordScreen';
import { AboutUsScreen } from '../screens/client/Settings/AboutUsScreen';
import { PrivacyPolicyScreen } from '../screens/client/Settings/PrivacyPolicyScreen';
import { TermsConditionsScreen } from '../screens/client/Settings/TermsConditionsScreen';

import { notificationsApi } from '../api/clientApi';
import { chatApi } from '../api/chatApi';
import { lawyerApi } from '../api/lawyerApi';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { isActionableLead } from '../types/lawyer';
import { isLawyerVerified } from '../utils/verification';
import { colors } from '../theme';
import type { GenieDrawerItem } from '../components/navigation';
import type {
  LawyerStackParamList,
  LawyerTabParamList,
} from '../types/navigation';

import { useT } from '../i18n/useT';
import { screenLayout } from './screenLayout';
import { useActiveRouteName } from './useActiveRouteName';
import { useRealtimeLive } from '../realtime/realtimeSession';

const shared = <P,>(screen: React.ComponentType<P>) =>
  screen as unknown as React.ComponentType<Record<string, never>>;

const Tab = createBottomTabNavigator<LawyerTabParamList>();
const Stack = createNativeStackNavigator<LawyerStackParamList>();

const renderTabBar = (props: BottomTabBarProps) => (
  <LawyerBottomNavigation {...props} />
);

const LawyerTabs: React.FC = () => (
  <Tab.Navigator
    screenLayout={screenLayout}
    screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      // Keep visited tabs mounted (state/scroll preserved) but skip
      // re-rendering them while hidden.
      freezeOnBlur: true,
    }}
    tabBar={renderTabBar}
  >
    <Tab.Screen name="Workspace" component={WorkspaceScreen} />
    <Tab.Screen name="Dashboard" component={LawyerDashboardScreen} />
    <Tab.Screen name="Leads" component={LeadsScreen} />
    <Tab.Screen name="Clients" component={LawyerClientsScreen} />
    <Tab.Screen name="Calendar" component={CalendarScreen} />
    <Tab.Screen name="LawyerProfile" component={LawyerProfileScreen} />
  </Tab.Navigator>
);

// Drawer item to highlight for each screen (detail screens light up their section).
const LAWYER_DRAWER_KEY_BY_ROUTE: Record<string, string> = {
  Workspace: 'workspace',
  Research: 'workspace',
  ResearchCases: 'workspace',
  ResearchDocuments: 'workspace',
  ResearchSession: 'workspace',
  Notes: 'workspace',
  Dashboard: 'dashboard',
  Leads: 'leads',
  LeadDetails: 'leads',
  Clients: 'clients',
  Calendar: 'calendar',
  Documents: 'documents',
  Payments: 'payments',
  PaymentDetails: 'payments',
  Hearings: 'hearings',
  Messages: 'messages',
  Chat: 'messages',
  Notifications: 'notifications',
  Subscription: 'subscription',
  Checkout: 'subscription',
  LawyerProfile: 'profile',
  LawyerMyProfile: 'profile',
  LawyerReviews: 'profile',
  Settings: 'settings',
  ChangePassword: 'settings',
  AboutUs: 'settings',
  PrivacyPolicy: 'settings',
  TermsConditions: 'settings',
};

const LawyerOverlays: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<LawyerStackParamList>>();

  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const isDrawerOpen = useUiStore(state => state.isDrawerOpen);
  const closeDrawer = useUiStore(state => state.closeDrawer);
  const activeRouteName = useActiveRouteName();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.list(1, 15),
  });

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: chatApi.getChats,
  });

  // Same key as the Leads screen. Kept fresh so the badge drops as soon as
  // another invited lawyer accepts a case (it becomes "Unavailable" here):
  // case_updated pushes refresh it; the interval only runs while that socket
  // is down.
  const casesLive = useRealtimeLive('cases');
  const leadsQuery = useQuery({
    queryKey: ['lawyer', 'leads'],
    queryFn: lawyerApi.getLeads,
    refetchInterval: casesLive ? false : 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  // Only leads still waiting for this lawyer's answer, as on the Leads tab.
  const newLeadsCount = (leadsQuery.data ?? []).filter(isActionableLead).length;

  // Opening the sidebar always shows the current lead count.
  const refetchLeads = leadsQuery.refetch;
  useEffect(() => {
    if (isDrawerOpen) {
      refetchLeads();
    }
  }, [isDrawerOpen, refetchLeads]);

  // Same key as Workspace/Dashboard/Profile, so this shares their cache.
  // The auth-store user has no verification field, so the drawer's badge
  // must come from the lawyer profile.
  const profileQuery = useQuery({
    queryKey: ['lawyer', 'profile', user?.id],
    queryFn: () => lawyerApi.getProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  const drawerUser = useMemo(
    () => (user ? { ...user, isVerified: isLawyerVerified(profileQuery.data) } : null),
    [user, profileQuery.data],
  );

  const unreadChatsCount = (chatsQuery.data ?? []).reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0,
  );

  const go = useCallback(
    <T extends keyof LawyerStackParamList>(
      screen: T,
      params?: LawyerStackParamList[T],
    ) => {
      closeDrawer();
      navigation.navigate(
        ...([screen, params] as unknown as Parameters<
          typeof navigation.navigate
        >),
      );
    },
    [closeDrawer, navigation],
  );

  const goToTab = useCallback(
    (screen: keyof LawyerTabParamList) => {
      closeDrawer();
      navigation.navigate(
        ...(['Tabs', { screen }] as unknown as Parameters<
          typeof navigation.navigate
        >),
      );
    },
    [closeDrawer, navigation],
  );

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      await logout();
      closeDrawer();
    } finally {
      setIsSigningOut(false);
    }
  }, [closeDrawer, isSigningOut, logout]);

  const { t } = useT();
  const items = useMemo<GenieDrawerItem[]>(
    () => [
      {
        key: 'workspace',
        label: t('common:nav.workspace'),
        Icon: GridIcon,
        onPress: () => goToTab('Workspace'),
      },
      {
        key: 'dashboard',
        label: t('common:nav.dashboard'),
        Icon: ChartIcon,
        onPress: () => goToTab('Dashboard'),
      },
      {
        key: 'leads',
        label: t('common:nav.leads'),
        Icon: UserPlusIcon,
        badge: newLeadsCount || undefined,
        onPress: () => goToTab('Leads'),
      },
      {
        key: 'clients',
        label: t('common:nav.clients'),
        Icon: UsersIcon,
        onPress: () => goToTab('Clients'),
      },
      {
        key: 'calendar',
        label: t('common:nav.calendar'),
        Icon: CalendarIcon,
        onPress: () => goToTab('Calendar'),
      },
      {
        key: 'documents',
        label: t('common:nav.documents'),
        Icon: FileIcon,
        onPress: () => go('Documents'),
      },
      {
        key: 'payments',
        label: t('common:nav.payments'),
        Icon: StarIcon,
        onPress: () => go('Payments'),
      },
      {
        key: 'hearings',
        label: t('common:nav.hearings'),
        Icon: ScalesIcon,
        onPress: () => go('Hearings'),
      },
      {
        key: 'messages',
        label: t('common:nav.messages'),
        Icon: ChatIcon,
        badge: unreadChatsCount > 0 ? unreadChatsCount : undefined,
        onPress: () => go('Messages'),
      },
      {
        key: 'notifications',
        label: t('common:nav.notifications'),
        Icon: BellIcon,
        badge: notificationsQuery.data?.unreadCount || undefined,
        onPress: () => go('Notifications'),
      },
      {
        key: 'subscription',
        label: t('common:nav.subscriptionPlans'),
        Icon: StarIcon,
        onPress: () => go('Subscription'),
      },
      {
        key: 'profile',
        label: t('common:nav.myProfile'),
        Icon: UserIcon,
        onPress: () => goToTab('LawyerProfile'),
      },
      {
        key: 'settings',
        label: t('common:nav.settings'),
        Icon: SettingsIcon,
        onPress: () => go('Settings'),
      },
    ],
    [
      go,
      goToTab,
      newLeadsCount,
      notificationsQuery.data?.unreadCount,
      t,
      unreadChatsCount,
    ],
  );

  return (
    <>
      <GenieDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        user={drawerUser}
        activeKey={activeRouteName ? LAWYER_DRAWER_KEY_BY_ROUTE[activeRouteName] : undefined}
        items={items}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        onAvatarPress={() => setIsProfileModalOpen(true)}
      />

      <LegalAcceptanceGate />

      <ProfileImageViewer
        visible={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        imageUri={user?.profileImage}
        name={user?.fullName}
      />
    </>
  );
};

export const LawyerNavigator: React.FC = () => (
  <View className="flex-1 bg-background">
    <Stack.Navigator
      screenLayout={screenLayout}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: true,
        // Screens under the top one keep their state but stop re-rendering
        // until they are shown again.
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="Tabs" component={LawyerTabs} />
      <Stack.Screen name="Hearings" component={HearingsScreen} />
      <Stack.Screen name="Research" component={ResearchScreen} />
      <Stack.Screen name="ResearchCases" component={ResearchCasesScreen} />
      <Stack.Screen name="ResearchDocuments" component={ResearchDocumentsScreen} />
      <Stack.Screen name="ResearchSession" component={ResearchSessionScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="LawyerMyProfile" component={LawyerMyProfileScreen} />
      <Stack.Screen name="LawyerReviews" component={LawyerReviewsScreen} />
      <Stack.Screen
        name="ProfessionalDetails"
        component={ProfessionalDetailsScreen}
      />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="PaymentDetails" component={PaymentDetailsScreen} />
      <Stack.Screen name="LeadDetails" component={LeadDetailsScreen} />
      <Stack.Screen
        name="LawyerClientDetails"
        component={LawyerClientDetailsScreen}
      />

      <Stack.Screen name="Documents" component={shared(DocumentsScreen)} />
      <Stack.Screen name="Messages" component={shared(MessagesScreen)} />
      <Stack.Screen name="Chat" component={shared(ChatScreen)} />
      <Stack.Screen name="Notifications" component={shared(NotificationsScreen)} />
      <Stack.Screen name="Settings" component={shared(SettingsScreen)} />
      <Stack.Screen name="ChangePassword" component={shared(ChangePasswordScreen)} />
      <Stack.Screen name="AboutUs" component={shared(AboutUsScreen)} />
      <Stack.Screen name="PrivacyPolicy" component={shared(PrivacyPolicyScreen)} />
      <Stack.Screen name="TermsConditions" component={shared(TermsConditionsScreen)} />
    </Stack.Navigator>

    <LawyerOverlays />
  </View>
);
