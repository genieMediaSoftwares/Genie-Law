import React from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieErrorState,
  GenieHeader,
  GenieScreen,
  GenieSectionHeader,
  GenieSkeleton,
  GenieText,
  VerifiedBadge,
  GenieRefreshControl,
} from '../../../components';
import {
  ChatIcon,
  ClockIcon,
  FileIcon,
  ScalesIcon,
  SearchIcon,
  SparkleIcon,
} from '../../../components/icons/ClientIcons';
import { UserPlusIcon, UsersIcon } from '../../../components/icons/LawyerIcons';
import { lawyerApi } from '../../../api/lawyerApi';
import { isActionableLead } from '../../../types/lawyer';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import type { LawyerTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { isLawyerVerified } from '../../../utils/verification';
import { useT } from '../../../i18n/useT';

interface WorkspaceCardProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  caption?: string;
  showBadge?: boolean;
  onPress?: () => void;
  unavailable?: boolean;
  unavailableReason?: string;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  title,
  icon,
  count,
  caption,
  showBadge = false,
  onPress,
  unavailable = false,
  unavailableReason,
}) => {
  const { t } = useT();
  return (
  <View className="w-1/2 p-1.5">
    <Pressable
      onPress={unavailable ? undefined : onPress}
      disabled={unavailable || !onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unavailable
          ? t('lawyer:workspace.titleReason', {
              title,
              reason: unavailableReason ?? t('lawyer:workspace.notAvailable'),
            })
          : title
      }
      accessibilityState={{ disabled: unavailable }}
      className={`min-h-[124px] justify-between rounded-[12px] border border-border bg-card p-4 ${
        unavailable ? 'opacity-50' : 'active:bg-surface-secondary'
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          {icon}
        </View>

        <View className="flex-row items-center gap-1.5">
          {showBadge && (
            <View className="h-2.5 w-2.5 rounded-full bg-gold" />
          )}

          {typeof count === 'number' ? (
            <GenieText variant="stat" tone="gold">
              {String(count)}
            </GenieText>
          ) : null}
        </View>
      </View>

      <View className="mt-3">
        <GenieText variant="cardTitle" className="text-white" numberOfLines={1}>
          {title}
        </GenieText>

        {unavailable ? (
          <GenieText variant="caption" tone="muted" className="mt-0.5" numberOfLines={1}>
            {unavailableReason ?? t('lawyer:workspace.notAvailable')}
          </GenieText>
        ) : caption ? (
          <GenieText variant="caption" tone="muted" className="mt-0.5" numberOfLines={1}>
            {caption}
          </GenieText>
        ) : null}
      </View>
    </Pressable>
  </View>
  );
};

export const WorkspaceScreen: React.FC<LawyerTabScreenProps<'Workspace'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const user = useAuthStore(state => state.user);
  const openDrawer = useUiStore(state => state.openDrawer);

  const leadsQuery = useQuery({
    queryKey: ['lawyer', 'leads'],
    queryFn: lawyerApi.getLeads,
  });

  const clientsQuery = useQuery({
    queryKey: ['lawyer', 'clients'],
    queryFn: lawyerApi.getClients,
  });

  const scheduleQuery = useQuery({
    queryKey: ['lawyer', 'schedule', 'today'],
    queryFn: lawyerApi.getScheduleToday,
  });

  const messagesQuery = useQuery({
    queryKey: ['lawyer', 'messages', 'unread'],
    queryFn: lawyerApi.getUnreadMessages,
  });

  const profileQuery = useQuery({
    queryKey: ['lawyer', 'profile', user?.id],
    queryFn: () => lawyerApi.getProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  const clientCount = clientsQuery.data
    ? clientsQuery.data.accepted.length +
      clientsQuery.data.inProgress.length +
      clientsQuery.data.closed.length
    : undefined;

  const hasPendingClientData = clientsQuery.data
    ? clientsQuery.data.accepted.length > 0
    : false;

  const isLoading =
    leadsQuery.isLoading ||
    clientsQuery.isLoading ||
    scheduleQuery.isLoading ||
    messagesQuery.isLoading ||
    profileQuery.isLoading;

  const isError =
    leadsQuery.isError ||
    clientsQuery.isError ||
    scheduleQuery.isError ||
    messagesQuery.isError ||
    profileQuery.isError;

  const errorMessage =
    (leadsQuery.error as Error)?.message ||
    (clientsQuery.error as Error)?.message ||
    (scheduleQuery.error as Error)?.message ||
    (messagesQuery.error as Error)?.message ||
    (profileQuery.error as Error)?.message ||
    t('lawyer:workspace.loadFailed');

  const refreshAll = () =>
    Promise.all([
      leadsQuery.refetch(),
      clientsQuery.refetch(),
      scheduleQuery.refetch(),
      messagesQuery.refetch(),
      profileQuery.refetch(),
    ]);

  const profile = profileQuery.data;
  const realName = profile?.user?.fullName || user?.fullName || t('lawyer:workspace.advocate');

  const scheduleCaption = scheduleQuery.data
    ? scheduleQuery.data.length === 0
      ? t('lawyer:workspace.noEventsToday')
      : t('lawyer:workspace.scheduledToday', { count: scheduleQuery.data.length })
    : t('lawyer:workspace.noEventsToday');

  const messagesCaption = messagesQuery.data
    ? messagesQuery.data.unreadCount === 0
      ? t('lawyer:workspace.caughtUp')
      : t('lawyer:workspace.unread', { count: messagesQuery.data.unreadCount })
    : t('lawyer:workspace.caughtUp');

  return (
    <GenieScreen
      scrollable
      dismissKeyboardOnTap={false}
      header={
        <GenieHeader
          onMenu={openDrawer}
          onNotifications={() => navigation.navigate('Notifications')}
        />
      }
      contentContainerClassName="pb-20"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={refreshAll} />
        ),
      }}
    >
      <View className="mt-2 mb-4 rounded-[12px] border border-border bg-card p-4">
        <GenieText variant="secondary" tone="secondary" className="font-medium">
          {t('lawyer:workspace.welcome')}
        </GenieText>

        <View className="mt-1 flex-row items-center gap-1.5">
          <GenieText variant="screenTitle" tone="gold" className="flex-shrink" numberOfLines={1}>
            {realName}
          </GenieText>
          {isLawyerVerified(profile) ? (
            <VerifiedBadge size={20} />
          ) : null}
        </View>

        <GenieText variant="secondary" tone="secondary" className="mt-3">
          {t('lawyer:workspace.intro')}
        </GenieText>
      </View>

      {isError ? (
        <GenieErrorState
          title={t('lawyer:workspace.unavailable')}
          message={errorMessage}
          onRetry={refreshAll}
          retryLabel={t('lawyer:workspace.retry')}
          className="mb-6"
        />
      ) : null}

      <GenieSectionHeader title={t('lawyer:workspace.tools')} />

      {isLoading ? (
        <View className="mt-2 flex-row flex-wrap -mx-1.5">
          <View className="w-1/2 p-1.5"><GenieSkeleton className="h-[124px] rounded-card" /></View>
          <View className="w-1/2 p-1.5"><GenieSkeleton className="h-[124px] rounded-card" /></View>
          <View className="w-1/2 p-1.5"><GenieSkeleton className="h-[124px] rounded-card" /></View>
          <View className="w-1/2 p-1.5"><GenieSkeleton className="h-[124px] rounded-card" /></View>
        </View>
      ) : (
        <View className="mt-2 flex-row flex-wrap -mx-1.5">
          <WorkspaceCard
            title={t('lawyer:workspace.newLeads')}
            icon={<UserPlusIcon size={20} color={colors.gold} />}
            count={leadsQuery.data?.filter(isActionableLead).length}
            caption={t('lawyer:workspace.newLeadsCaption')}
            onPress={() => navigation.navigate('Leads')}
          />
          <WorkspaceCard
            title={t('lawyer:workspace.clients')}
            icon={<UsersIcon size={20} color={colors.gold} />}
            count={clientCount}
            caption={t('lawyer:workspace.clientsCaption')}
            showBadge={hasPendingClientData}
            onPress={() => navigation.navigate('Clients')}
          />
          <WorkspaceCard
            title={t('lawyer:workspace.schedule')}
            icon={<ClockIcon size={20} color={colors.gold} />}
            count={scheduleQuery.data?.length}
            caption={scheduleCaption}
            onPress={() => navigation.navigate('Calendar')}
          />
          <WorkspaceCard
            title={t('lawyer:workspace.messages')}
            icon={<ChatIcon size={20} color={colors.gold} />}
            count={messagesQuery.data?.unreadCount}
            caption={messagesCaption}
            onPress={() => navigation.navigate('Messages')}
          />
        </View>
      )}

      <View className="mt-6">
        <GenieText variant="heading-sm" className="font-bold text-white">
          {t('lawyer:workspace.practice')}
        </GenieText>
        <GenieText variant="caption" tone="secondary" className="mt-0.5">
          {t('lawyer:workspace.practiceCaption')}
        </GenieText>
      </View>

      <View className="mt-3 flex-row flex-wrap -mx-1.5">
        <WorkspaceCard
          title={t('lawyer:workspace.documents')}
          icon={<FileIcon size={20} color={colors.gold} />}
          onPress={() => navigation.navigate('Documents')}
        />
        <WorkspaceCard
          title={t('lawyer:workspace.research')}
          icon={<SearchIcon size={20} color={colors.gold} />}
          caption={t('lawyer:workspace.researchCaption')}
          onPress={() => navigation.navigate('Research')}
        />
        <WorkspaceCard
          title={t('lawyer:workspace.hearings')}
          icon={<ScalesIcon size={20} color={colors.gold} />}
          onPress={() => navigation.navigate('Hearings')}
        />
        <WorkspaceCard
          title={t('lawyer:workspace.notes')}
          icon={<FileIcon size={20} color={colors.gold} />}
          caption={t('lawyer:workspace.notesCaption')}
          onPress={() => navigation.navigate('Notes')}
        />
      </View>

      <View className="mt-6 mb-4 rounded-card border border-border bg-card p-4">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-gold-muted border border-border">
            <SparkleIcon size={16} color={colors.gold} />
          </View>
          <GenieText variant="body-md" tone="gold" className="font-bold">
            {t('lawyer:workspace.tipTitle')}
          </GenieText>
        </View>

        <GenieText variant="body-sm" tone="secondary" className="mt-2 leading-5">
          {t('lawyer:workspace.tip')}
        </GenieText>
      </View>
    </GenieScreen>
  );
};
