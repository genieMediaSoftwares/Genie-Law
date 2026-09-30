import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieErrorState,
  GenieHeader,
  GenieScreen,
  GenieSkeleton,
  GenieText,
  VerifiedBadge,
  GenieRefreshControl,
} from '../../../components';
import {
  BellIcon,
  ChevronRightIcon,
  ChatIcon,
  FileIcon,
  StarIcon,
} from '../../../components/icons/ClientIcons';
import { UserPlusIcon } from '../../../components/icons/LawyerIcons';
import { lawyerApi } from '../../../api/lawyerApi';
import { notificationsApi } from '../../../api/clientApi';
import { isActionableLead } from '../../../types/lawyer';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import type { LawyerTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { isLawyerVerified } from '../../../utils/verification';
import { useT } from '../../../i18n/useT';
import { practiceAreaLabel } from '../../../i18n/labels';

const formatCount = (num?: number): string => {
  if (typeof num !== 'number') return '0';
  return String(num);
};

export const LawyerDashboardScreen: React.FC<
  LawyerTabScreenProps<'Dashboard'>
> = ({ navigation }) => {
  const { t } = useT();
  const user = useAuthStore(state => state.user);
  const openDrawer = useUiStore(state => state.openDrawer);

  const profileQuery = useQuery({
    queryKey: ['lawyer', 'profile', user?.id],
    queryFn: () => lawyerApi.getProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  const leadsQuery = useQuery({
    queryKey: ['lawyer', 'leads'],
    queryFn: lawyerApi.getLeads,
  });

  const clientsQuery = useQuery({
    queryKey: ['lawyer', 'clients'],
    queryFn: lawyerApi.getClients,
  });

  const messagesQuery = useQuery({
    queryKey: ['lawyer', 'messages', 'unread'],
    queryFn: lawyerApi.getUnreadMessages,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.list(1, 15),
  });

  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: lawyerApi.getSubscription,
  });

  const header = (
    <GenieHeader
      title={t('lawyer:dashboard.title')}
      onMenu={openDrawer}
      onNotifications={() => navigation.navigate('Notifications')}
      notificationCount={notificationsQuery.data?.unreadCount ?? 0}
    />
  );

  const isLoading =
    profileQuery.isLoading ||
    leadsQuery.isLoading ||
    clientsQuery.isLoading ||
    messagesQuery.isLoading ||
    subscriptionQuery.isLoading;

  const isError =
    profileQuery.isError ||
    leadsQuery.isError ||
    clientsQuery.isError ||
    messagesQuery.isError;

  const errorMessage =
    (profileQuery.error as Error)?.message ||
    (leadsQuery.error as Error)?.message ||
    (clientsQuery.error as Error)?.message ||
    (messagesQuery.error as Error)?.message ||
    t('lawyer:dashboard.loadFailed');

  const refreshAll = () =>
    Promise.all([
      profileQuery.refetch(),
      leadsQuery.refetch(),
      clientsQuery.refetch(),
      messagesQuery.refetch(),
      subscriptionQuery.refetch(),
    ]);

  if (isLoading) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <View className="py-3">
          <GenieSkeleton className="h-24 w-full rounded-card" />
          <GenieSkeleton className="mt-4 h-32 w-full rounded-card" />
          <GenieSkeleton className="mt-6 h-64 w-full rounded-card" />
        </View>
      </GenieScreen>
    );
  }

  if (isError) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <View className="py-3">
          <GenieErrorState
            title={t('lawyer:dashboard.unavailable')}
            message={errorMessage}
            onRetry={refreshAll}
            retryLabel={t('lawyer:dashboard.tryAgain')}
          />
        </View>
      </GenieScreen>
    );
  }

  const profile = profileQuery.data;
  const fullName = profile?.user?.fullName || user?.fullName || t('lawyer:dashboard.advocate');
  const displayName = fullName.toLowerCase().startsWith('adv.')
    ? fullName
    : t('common:advocate.advName', { name: fullName });

  const reviewsVal = profile?.totalReviews ?? 0;
  const ratingVal =
    reviewsVal > 0 && profile?.rating ? profile.rating.toFixed(1) : null;
  const specialization = profile?.specialization || '';

  const newLeadsCount = (leadsQuery.data ?? []).filter(isActionableLead).length;
  const unreadMessagesCount = messagesQuery.data?.unreadCount ?? 0;
  const inProgressCount = clientsQuery.data?.inProgress.length ?? 0;
  const acceptedCount = clientsQuery.data?.accepted.length ?? 0;

  return (
    <GenieScreen
      scrollable
      header={header}
      dismissKeyboardOnTap={false}
      contentContainerClassName="pb-20"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={refreshAll} />
        ),
      }}
    >
      <Pressable
        onPress={() => navigation.navigate('LawyerMyProfile')}
        accessibilityRole="button"
        accessibilityLabel={t('lawyer:dashboard.openProfileA11y', { name: displayName })}
        className="mt-2 flex-row items-center active:opacity-70"
      >
        <GenieAvatar
          uri={profile?.user?.profileImage ?? user?.profileImage}
          name={fullName}
          size="profile"
        />

        <View className="ml-4 flex-1">
          <View className="flex-row items-center gap-1.5">
            <GenieText variant="sectionTitle" className="flex-shrink" numberOfLines={1}>
              {displayName}
            </GenieText>
            {isLawyerVerified(profile) ? (
              <VerifiedBadge size={18} />
            ) : null}
          </View>

          {specialization ? (
            <GenieText variant="secondary" tone="secondary" className="mt-0.5">
              {practiceAreaLabel(specialization)}
            </GenieText>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate('LawyerReviews')}
            accessibilityRole="button"
            accessibilityLabel={t('lawyer:dashboard.openReviews')}
            hitSlop={8}
            className="mt-1 flex-row items-center gap-1 self-start active:opacity-70"
          >
            <StarIcon size={14} color={colors.gold} />
            <GenieText variant="caption" tone="secondary" className="font-medium">
              {ratingVal
                ? t('lawyer:dashboard.ratingReviews', { rating: ratingVal, count: reviewsVal })
                : t('lawyer:dashboard.noReviews')}
            </GenieText>
          </Pressable>
        </View>
        <ChevronRightIcon size={16} color={colors.textMuted} />
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Subscription')}
        accessibilityRole="button"
        accessibilityLabel={t('lawyer:dashboard.premiumA11y')}
        className="mt-5 rounded-[12px] border border-border bg-card p-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <StarIcon size={16} color={colors.gold} />
          <GenieText variant="cardTitle">
            {t('lawyer:dashboard.premium')}
          </GenieText>
        </View>

        <View className="mt-2 flex-row items-center justify-between gap-3">
          <GenieText variant="secondary" tone="secondary" className="flex-1">
            {t('lawyer:dashboard.premiumText')}
          </GenieText>

          <Pressable
            onPress={() => navigation.navigate('Subscription')}
            accessibilityRole="button"
            accessibilityLabel={t('lawyer:dashboard.viewPlan')}
            className="h-[36px] items-center justify-center rounded-[8px] bg-gold px-4 active:bg-gold-pressed"
          >
            <GenieText variant="button" tone="on-gold">
              {t('lawyer:dashboard.viewPlan')}
            </GenieText>
          </Pressable>
        </View>
      </Pressable>

      <GenieText variant="sectionTitle" className="mb-3 mt-6">
        {t('lawyer:dashboard.overview')}
      </GenieText>

      <View className="rounded-[12px] border border-border bg-card px-4 py-1">
        <OverviewRow
          icon={<UserPlusIcon size={18} color={colors.gold} />}
          title={t('lawyer:dashboard.newRequests')}
          subtitle={t('lawyer:dashboard.newRequestsSub')}
          value={newLeadsCount}
          onPress={() => navigation.navigate('Leads')}
        />
        <View className="h-px bg-border" />
        <OverviewRow
          icon={<ChatIcon size={18} color={colors.gold} />}
          title={t('lawyer:dashboard.unread')}
          subtitle={t('lawyer:dashboard.unreadSub')}
          value={unreadMessagesCount}
          onPress={() => navigation.navigate('Messages')}
        />
        <View className="h-px bg-border" />
        <OverviewRow
          icon={<FileIcon size={18} color={colors.gold} />}
          title={t('lawyer:dashboard.inProgress')}
          subtitle={t('lawyer:dashboard.inProgressSub')}
          value={inProgressCount}
          onPress={() => navigation.navigate('Clients', { tab: 'inProgress' })}
        />
        <View className="h-px bg-border" />
        <OverviewRow
          icon={<BellIcon size={18} color={colors.gold} />}
          title={t('lawyer:dashboard.accepted')}
          subtitle={t('lawyer:dashboard.acceptedSub')}
          value={acceptedCount}
          onPress={() => navigation.navigate('Clients', { tab: 'active' })}
        />
      </View>
    </GenieScreen>
  );
};

interface OverviewRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: number;
  onPress: () => void;
}

// One "Today's Overview" line; tapping it opens the matching section.
const OverviewRow: React.FC<OverviewRowProps> = ({ icon, title, subtitle, value, onPress }) => {
  const { t } = useT();
  return (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={t('lawyer:dashboard.rowA11y', { title, value })}
    className="flex-row items-center justify-between py-3 active:opacity-70"
  >
    <View className="flex-row items-center flex-1 pr-3">
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
        {icon}
      </View>
      <View className="flex-1">
        <GenieText variant="body" className="font-medium">
          {title}
        </GenieText>
        <GenieText variant="caption" tone="muted" className="mt-0.5">
          {subtitle}
        </GenieText>
      </View>
    </View>

    <View className="flex-row items-center">
      <GenieText variant="body" className="font-semibold text-white">
        {formatCount(value)}
      </GenieText>
      <ChevronRightIcon size={16} color={colors.textMuted} />
    </View>
  </Pressable>
  );
};
