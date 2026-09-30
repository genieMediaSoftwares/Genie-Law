import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';

import { GenieBottomNavigation, GenieDrawer } from '../components/navigation';
import { CreateCaseSheet } from '../components/CreateCaseSheet';
import { ProfileImageViewer } from '../components/ui/ProfileImageViewer';
import { LegalAcceptanceGate } from '../components/legal';
import {
  BellIcon,
  BriefcaseIcon,
  CardIcon,
  ChatIcon,
  ClockIcon,
  FileIcon,
  HeartIcon,
  HomeIcon,
  InfoCircleIcon,
  ScalesIcon,
  SettingsIcon,
  StarIcon,
} from '../components/icons/ClientIcons';
import { UserIcon } from '../components/icons/Icons';
import { notificationsApi } from '../api/clientApi';
import { chatApi } from '../api/chatApi';
import { HomeScreen } from '../screens/client/Home/HomeScreen';
import { MyCasesScreen } from '../screens/client/Cases/MyCasesScreen';
import { CaseDetailsScreen } from '../screens/client/Cases/CaseDetailsScreen';
import { AdvocatesScreen } from '../screens/client/Advocates/AdvocatesScreen';
import { AdvocateProfileScreen } from '../screens/client/Advocates/AdvocateProfileScreen';
import { ProfileScreen } from '../screens/client/Profile/ProfileScreen';
import { NotificationsScreen } from '../screens/client/Notifications/NotificationsScreen';
import { FavoritesScreen } from '../screens/client/Favorites/FavoritesScreen';
import { MessagesScreen } from '../screens/client/Messages/MessagesScreen';
import { ChatScreen } from '../screens/client/Messages/ChatScreen';
import { DocumentsScreen } from '../screens/client/Documents/DocumentsScreen';
import { SettingsScreen } from '../screens/client/Settings/SettingsScreen';
import { MyProfileDetailScreen } from '../screens/client/Profile/MyProfileDetailScreen';
import { AppointmentsScreen } from '../screens/client/Appointments/AppointmentsScreen';
import { PersonalInformationScreen } from '../screens/client/Profile/PersonalInformationScreen';
import { RecentActivityScreen } from '../screens/client/Profile/RecentActivityScreen';
import { ChangePasswordScreen } from '../screens/client/Settings/ChangePasswordScreen';
import { AboutUsScreen } from '../screens/client/Settings/AboutUsScreen';
import { PrivacyPolicyScreen } from '../screens/client/Settings/PrivacyPolicyScreen';
import { TermsConditionsScreen } from '../screens/client/Settings/TermsConditionsScreen';
import { AllCategoriesScreen } from '../screens/client/Categories/AllCategoriesScreen';
import { PostCaseScreen } from '../screens/client/PostCase/PostCaseScreen';
import { AiAssistantScreen } from '../screens/client/AI/AiAssistantScreen';
import { AiSessionScreen } from '../screens/client/AI/AiSessionScreen';
import { AiChatScreen } from '../screens/client/AI/AiChatScreen';
import { PaymentsScreen } from '../screens/client/Payments/PaymentsScreen';
import { PaymentDetailsScreen } from '../screens/payments/PaymentDetailsScreen';
import { ReviewsScreen } from '../screens/client/Reviews/ReviewsScreen';
import { DisputesScreen } from '../screens/client/Disputes/DisputesScreen';
import { UrgentHelpScreen } from '../screens/client/Urgent/UrgentHelpScreen';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { colors } from '../theme';
import type { GenieDrawerItem } from '../components/navigation';
import type {
  ClientStackParamList,
  ClientTabParamList,
} from '../types/navigation';

import { useT } from '../i18n/useT';
import { screenLayout } from './screenLayout';

const Tab = createBottomTabNavigator<ClientTabParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();

const renderTabBar = (props: BottomTabBarProps) => (
  <GenieBottomNavigation {...props} />
);

const ClientTabs: React.FC = () => {
  return (
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cases" component={MyCasesScreen} />
      <Tab.Screen name="Advocates" component={AdvocatesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const ClientOverlays: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();

  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const isDrawerOpen = useUiStore(state => state.isDrawerOpen);
  const closeDrawer = useUiStore(state => state.closeDrawer);
  const isCreateSheetOpen = useUiStore(state => state.isCreateSheetOpen);
  const closeCreateSheet = useUiStore(state => state.closeCreateSheet);

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

  const unreadChatsCount = (chatsQuery.data || []).reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0,
  );

  const go = useCallback(
    <T extends keyof ClientStackParamList>(
      screen: T,
      params?: ClientStackParamList[T],
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
    (screen: keyof ClientTabParamList) => {
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
    if (isSigningOut) return;
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
        key: 'dashboard',
        label: t('common:nav.dashboard'),
        Icon: HomeIcon,
        onPress: () => go('Tabs'),
      },
      {
        key: 'cases',
        label: t('common:nav.myCases'),
        Icon: BriefcaseIcon,
        onPress: () => goToTab('Cases'),
      },
      {
        key: 'advocates',
        label: t('common:nav.advocates'),
        Icon: ScalesIcon,
        onPress: () => goToTab('Advocates'),
      },
      {
        key: 'messages',
        label: t('common:nav.messages'),
        Icon: ChatIcon,
        badge: unreadChatsCount > 0 ? unreadChatsCount : undefined,
        onPress: () => go('Messages'),
      },
      {
        key: 'documents',
        label: t('common:nav.myDocuments'),
        Icon: FileIcon,
        onPress: () => go('Documents'),
      },
      {
        key: 'favorites',
        label: t('common:nav.favoriteLawyers'),
        Icon: HeartIcon,
        onPress: () => go('Favorites'),
      },
      {
        key: 'payments',
        label: t('common:nav.payments'),
        Icon: CardIcon,
        onPress: () => go('Payments'),
      },
      {
        key: 'reviews',
        label: t('common:nav.myReviews'),
        Icon: StarIcon,
        onPress: () => go('Reviews'),
      },
      {
        key: 'disputes',
        label: t('common:nav.disputes'),
        Icon: InfoCircleIcon,
        onPress: () => go('Disputes'),
      },
      {
        key: 'urgent',
        label: t('common:nav.urgentLegalHelp'),
        Icon: ClockIcon,
        onPress: () => go('UrgentHelp'),
      },
      {
        key: 'profile',
        label: t('common:nav.myProfile'),
        Icon: UserIcon,
        onPress: () => goToTab('Profile'),
      },
      {
        key: 'notifications',
        label: t('common:nav.notifications'),
        Icon: BellIcon,
        badge: notificationsQuery.data?.unreadCount ?? 0,
        onPress: () => go('Notifications'),
      },
      {
        key: 'settings',
        label: t('common:nav.settings'),
        Icon: SettingsIcon,
        onPress: () => go('Settings'),
      },
    ],
    [go, goToTab, notificationsQuery.data?.unreadCount, t, unreadChatsCount],
  );

  return (
    <>
      <GenieDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        user={user}
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
        onEdit={() => {
          setIsProfileModalOpen(false);
          go('MyProfileDetail');
        }}
      />

      <CreateCaseSheet
        visible={isCreateSheetOpen}
        onClose={closeCreateSheet}
        onStartManual={() => {
          closeCreateSheet();
          navigation.navigate('PostCase', { start: 'manual' });
        }}
        onStartAi={() => {
          closeCreateSheet();
          navigation.navigate('AiAssistant');
        }}
      />
    </>
  );
};

export const ClientNavigator: React.FC = () => (
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
      <Stack.Screen name="Tabs" component={ClientTabs} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="AdvocateProfile" component={AdvocateProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="MyProfileDetail" component={MyProfileDetailScreen} />
      <Stack.Screen name="Appointments" component={AppointmentsScreen} />
      <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
      <Stack.Screen name="RecentActivity" component={RecentActivityScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="AboutUs" component={AboutUsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
      <Stack.Screen name="AllCategories" component={AllCategoriesScreen} />
      <Stack.Screen name="PostCase" component={PostCaseScreen} />
      <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />
      <Stack.Screen name="AiSession" component={AiSessionScreen} />
      <Stack.Screen name="AiChat" component={AiChatScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="PaymentDetails" component={PaymentDetailsScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Disputes" component={DisputesScreen} />
      <Stack.Screen name="UrgentHelp" component={UrgentHelpScreen} />
    </Stack.Navigator>

    <ClientOverlays />
  </View>
);
