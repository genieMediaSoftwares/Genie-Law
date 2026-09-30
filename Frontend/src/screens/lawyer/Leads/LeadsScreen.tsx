import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieBottomSheet,
  GenieFilterTabs,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieNotice,
  GenieSearchInput,
  GenieSkeletonList,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import {
  ClockIcon,
  CloseIcon,
  EyeIcon,
  FileIcon,
  LocationIcon,
  MoreVerticalIcon,
  ScalesIcon,
} from '../../../components/icons/ClientIcons';
import { UserPlusIcon } from '../../../components/icons/LawyerIcons';
import { CheckIcon } from '../../../components/icons/Icons';
import { lawyerApi } from '../../../api/lawyerApi';
import { notificationsApi } from '../../../api/clientApi';
import { useUiStore } from '../../../store/uiStore';
import { toAppError } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import { isActionableLead } from '../../../types/lawyer';
import type { LawyerLead } from '../../../types/lawyer';
import type { LawyerTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useFallbackPoll } from '../../../hooks/useScreenFocused';
import { useT } from '../../../i18n/useT';
import { categoryLabel, displayLabel } from '../../../i18n/labels';

type LeadTab = 'new' | 'accepted';

export const LeadsScreen: React.FC<LawyerTabScreenProps<'Leads'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<LeadTab>('new');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  // The lead whose "more" menu (three dots) is open.
  const [menuLead, setMenuLead] = useState<LawyerLead | null>(null);

  // Pushed over Socket.IO; polled (while visible) only if the socket is down.
  const pollCases = useFallbackPoll('cases');
  const pollNotifications = useFallbackPoll('notifications');

  const leadsQuery = useQuery({
    queryKey: ['lawyer', 'leads'],
    queryFn: lawyerApi.getLeads,
    refetchInterval: pollCases(3000),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  const clientsQuery = useQuery({
    queryKey: ['lawyer', 'clients'],
    queryFn: lawyerApi.getClients,
    refetchInterval: pollCases(3000),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.list(1, 15),
    refetchInterval: pollNotifications(10000),
  });

  const unreadNotificationsCount = notificationsQuery.data?.unreadCount ?? 0;

  const settle = async () => {
    setBusyCaseId(null);
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'leads'] });
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'clients'] });
    await queryClient.invalidateQueries({ queryKey: ['chats'] });
  };

  const failAndRefresh = async (error: unknown) => {
    setBusyCaseId(null);
    setActionError(toAppError(error).message);
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'leads'] });
  };

  const acceptMutation = useMutation({
    mutationFn: (caseId: string) => lawyerApi.acceptLead(caseId),
    onError: failAndRefresh,
    onSuccess: settle,
  });

  const declineMutation = useMutation({
    mutationFn: (caseId: string) => lawyerApi.rejectLead(caseId),
    onError: failAndRefresh,
    onSuccess: settle,
  });

  const respond = (caseId: string, action: 'accept' | 'decline') => {
    if (busyCaseId) {
      return;
    }
    setActionError(null);
    setBusyCaseId(caseId);
    if (action === 'accept') {
      acceptMutation.mutate(caseId);
    } else {
      declineMutation.mutate(caseId);
    }
  };

  const newLeads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const pendingLeadCount = useMemo(
    () => newLeads.filter(isActionableLead).length,
    [newLeads],
  );
  const acceptedRows = useMemo(
    () => clientsQuery.data?.accepted ?? [],
    [clientsQuery.data],
  );

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return newLeads;
    }
    return newLeads.filter(
      l =>
        l.issueTitle.toLowerCase().includes(q) ||
        l.clientName.toLowerCase().includes(q) ||
        l.issueCategory.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q),
    );
  }, [newLeads, search]);

  const filteredAccepted = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return acceptedRows;
    }
    return acceptedRows.filter(
      r =>
        r.issue.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [acceptedRows, search]);

  const activeQuery = tab === 'new' ? leadsQuery : clientsQuery;

  const renderLeadCard = (item: LawyerLead) => {
    const isBusy = busyCaseId === item.caseId;
    const isAvailable = isActionableLead(item);
    const docCount = item.documentsCount ?? (item.acknowledgementDocument ? 1 : 0);
    const matchPct =
      typeof item.matchPercentage === 'number' ? item.matchPercentage : null;

    if (!isAvailable) {
      return (
        <View
          key={item.caseId}
          testID={`lead-unavailable-${item.caseId}`}
          className="mb-3 rounded-card bg-surface p-4"
        >
          <View className="flex-row items-start justify-between">
            <GenieText variant="cardTitle" className="flex-1 pr-2" numberOfLines={1}>
              {item.issueTitle}
            </GenieText>
            <View className="rounded-full bg-surface-secondary px-2 py-0.5">
              <GenieText variant="caption" tone="muted">
                {t('lawyer:leads.unavailable')}
              </GenieText>
            </View>
          </View>
          <GenieText variant="body-sm" tone="secondary" className="mt-1" numberOfLines={1}>
            {categoryLabel(item.issueCategory) || t('lawyer:leads.generalPractice')}
          </GenieText>
          <GenieText variant="caption" tone="muted" className="mt-2">
            {item.unavailableReason || t('lawyer:leads.noLongerAvailable')}
          </GenieText>
        </View>
      );
    }

    return (
      <View
        key={item.caseId}
        className="mb-3 rounded-card bg-surface p-4"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <View>
              <GenieAvatar
                uri={item.clientProfileImage}
                name={item.clientName}
                size="md"
              />
              <View className="mt-1 self-center rounded-full bg-surface-secondary px-2 py-0.5">
                <GenieText variant="caption" tone="gold" className="font-semibold">
                  {t('lawyer:leads.new')}
                </GenieText>
              </View>
            </View>

            <View className="flex-1">
              <GenieText variant="cardTitle" numberOfLines={1}>
                {item.clientName}
              </GenieText>
              <GenieText variant="body-sm" tone="secondary" className="mt-0.5" numberOfLines={1}>
                {t('lawyer:leads.caseLine', { title: item.issueTitle })}
              </GenieText>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {matchPct !== null ? (
              <GenieText variant="caption" tone="success" className="font-semibold">
                {t('lawyer:leads.match', { percent: matchPct })}
              </GenieText>
            ) : null}
            <Pressable
              testID={`lead-menu-${item.caseId}`}
              onPress={() => setMenuLead(item)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:leads.moreA11y', { name: item.clientName })}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-secondary"
            >
              <MoreVerticalIcon size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View className="mt-4 gap-2">
          <View className="flex-row items-center gap-3">
            <LocationIcon size={14} color={colors.textMuted} />
            <GenieText variant="caption" tone="secondary" numberOfLines={1}>
              {item.location || t('lawyer:leads.notSpecified')}
            </GenieText>
          </View>

          <View className="flex-row items-center gap-3">
            <ScalesIcon size={14} color={colors.textMuted} />
            <GenieText variant="caption" tone="secondary" numberOfLines={1}>
              {categoryLabel(item.issueCategory) || t('lawyer:leads.generalPractice')}
            </GenieText>
          </View>

          <View className="flex-row items-center gap-3">
            <ClockIcon size={14} color={colors.textMuted} />
            <GenieText variant="caption" tone="secondary" numberOfLines={1}>
              {t('lawyer:leads.urgency', {
                value: displayLabel('cases:urgency', item.urgency || 'Flexible'),
              })}
            </GenieText>
          </View>

          <View className="flex-row items-center gap-3">
            <FileIcon size={14} color={colors.textMuted} />
            <GenieText variant="caption" tone="secondary" numberOfLines={1}>
              {t('lawyer:leads.docs', { count: docCount })}
            </GenieText>
          </View>
        </View>

        <GenieText variant="caption" tone="muted" className="mt-3">
          {t('lawyer:leads.postedOn', { date: formatDate(item.postedTime) })}
        </GenieText>

        <Pressable
          testID={`lead-view-details-${item.caseId}`}
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('LeadDetails', { caseId: String(item.caseId) })
          }
          className="mt-4 items-center justify-center rounded-control border border-border py-2.5 active:bg-surface-secondary"
        >
          <GenieText variant="button" tone="gold" className="font-semibold">
            {t('lawyer:leads.viewDetails')}
          </GenieText>
        </Pressable>

        <View className="mt-3 flex-row gap-3">
          <Pressable
            testID={`lead-decline-${item.caseId}`}
            disabled={Boolean(busyCaseId)}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(busyCaseId) }}
            onPress={() => respond(item.caseId, 'decline')}
            className={`flex-1 items-center justify-center rounded-control border border-border py-2.5 active:bg-surface-secondary ${
              busyCaseId ? 'opacity-50' : ''
            }`}
          >
            <GenieText variant="button" tone="secondary">
              {t('lawyer:leads.decline')}
            </GenieText>
          </Pressable>

          <Pressable
            testID={`lead-accept-${item.caseId}`}
            disabled={Boolean(busyCaseId)}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(busyCaseId), busy: isBusy }}
            onPress={() => respond(item.caseId, 'accept')}
            className={`flex-1 items-center justify-center rounded-control bg-gold py-2.5 active:bg-gold-pressed ${
              busyCaseId ? 'opacity-50' : ''
            }`}
          >
            <GenieText variant="button" tone="on-gold" className="font-bold">
              {isBusy ? t('lawyer:leads.processing') : t('lawyer:leads.accept')}
            </GenieText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (activeQuery.isPending) {
      return (
        <View className="px-4">
          <GenieSkeletonList count={3} />
        </View>
      );
    }

    if (activeQuery.isError) {
      return (
        <View className="px-4">
          <GenieErrorState
            message={activeQuery.error.message}
            onRetry={() => activeQuery.refetch()}
          />
        </View>
      );
    }

    if (tab === 'new') {
      return (
        <FlatList
          data={filteredLeads}
          keyExtractor={item => item.caseId}
          contentContainerClassName="px-4 pb-12 pt-1"
          contentContainerStyle={
            filteredLeads.length === 0
              ? { flexGrow: 1, justifyContent: 'center' }
              : undefined
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <GenieRefreshControl onRefresh={() => Promise.all([leadsQuery.refetch(), notificationsQuery.refetch()])} />
          }
          renderItem={({ item }) => renderLeadCard(item)}
          ListHeaderComponent={
            filteredLeads.length > 0 ? (
              <GenieText className="mb-3 font-bold text-lg text-text-primary">
                {t('lawyer:leads.newLeads')}
              </GenieText>
            ) : undefined
          }
          ListEmptyComponent={
            <GenieEmptyState
              icon={<UserPlusIcon size={28} color={colors.gold} />}
              title={search.trim() ? t('lawyer:leads.noMatches') : t('lawyer:leads.noNew')}
              description={
                search.trim()
                  ? t('lawyer:leads.nothingMatches', { search })
                  : t('lawyer:leads.noNewHint')
              }
              actionLabel={search.trim() ? t('lawyer:leads.clearSearch') : undefined}
              onAction={search.trim() ? () => setSearch('') : undefined}
            />
          }
        />
      );
    }

    return (
      <FlatList
        data={filteredAccepted}
        keyExtractor={item => item.caseId}
        contentContainerClassName="px-4 pb-12 pt-1"
        contentContainerStyle={
          filteredAccepted.length === 0
            ? { flexGrow: 1, justifyContent: 'center' }
            : undefined
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <GenieRefreshControl onRefresh={() => Promise.all([clientsQuery.refetch(), notificationsQuery.refetch()])} />
        }
        renderItem={({ item }) => (
          <View className="mb-3 rounded-card border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <GenieAvatar uri={item.profileImage} name={item.name} size="md" />
                <View className="flex-1">
                  <GenieText className="font-bold text-base text-text-primary" numberOfLines={1}>
                    {item.name}
                  </GenieText>
                  <GenieText className="mt-0.5 text-xs text-text-secondary" numberOfLines={1}>
                    {item.issue}
                  </GenieText>
                </View>
              </View>
              <View className="rounded-md border border-success bg-success-surface px-2.5 py-1">
                <GenieText tone="success" className="font-semibold text-xs">
                  {t('lawyer:leads.accepted')}
                </GenieText>
              </View>
            </View>
            <GenieText className="mt-3 text-xs text-text-muted">
              {t('lawyer:leads.acceptedOn', { date: formatDate(item.acceptedAt || item.lastActivity) })}
            </GenieText>
          </View>
        )}
        ListEmptyComponent={
          <GenieEmptyState
            icon={<UserPlusIcon size={28} color={colors.gold} />}
            title={t('lawyer:leads.noAccepted')}
            description={t('lawyer:leads.noAcceptedHint')}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('lawyer:leads.title')}
        onMenu={openDrawer}
        onNotifications={() => (navigation as any).navigate('Notifications')}
        notificationCount={unreadNotificationsCount}
      />

      <GenieFilterTabs
        className="px-4 pt-2"
        testIDPrefix="leads-tab"
        tabs={[
          { key: 'new', label: t('lawyer:leads.newLeads'), count: pendingLeadCount },
          { key: 'accepted', label: t('lawyer:leads.accepted'), count: acceptedRows.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <View className="px-4 pb-2 pt-3">
        <GenieSearchInput
          placeholder={t('lawyer:leads.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {actionError ? (
        <View className="px-4 pb-2">
          <GenieNotice message={actionError} />
        </View>
      ) : null}

      {renderBody()}

      <GenieBottomSheet
        visible={menuLead !== null}
        onClose={() => setMenuLead(null)}
      >
        {menuLead ? (
          <View className="pb-2">
            <View className="mb-2 flex-row items-center gap-3 rounded-card border border-border bg-surface-alt p-3">
              <GenieAvatar uri={menuLead.clientProfileImage} name={menuLead.clientName} size="md" />
              <View className="flex-1">
                <GenieText className="font-bold text-base text-text-primary" numberOfLines={1}>
                  {menuLead.clientName}
                </GenieText>
                <GenieText className="mt-0.5 text-xs text-text-secondary" numberOfLines={1}>
                  {t('lawyer:leads.caseLine', { title: menuLead.issueTitle })}
                </GenieText>
              </View>
            </View>

            {[
              {
                key: 'view',
                label: t('lawyer:leads.viewDetails'),
                icon: <EyeIcon size={20} color={colors.textSecondary} />,
                onPress: () =>
                  navigation.navigate('LeadDetails', { caseId: String(menuLead.caseId) }),
              },
              {
                key: 'accept',
                label: t('lawyer:leads.accept'),
                icon: <CheckIcon size={20} color={colors.gold} />,
                onPress: () => respond(menuLead.caseId, 'accept'),
                disabled: Boolean(busyCaseId),
              },
              {
                key: 'decline',
                label: t('lawyer:leads.decline'),
                icon: <CloseIcon size={20} color={colors.error} />,
                onPress: () => respond(menuLead.caseId, 'decline'),
                disabled: Boolean(busyCaseId),
                destructive: true,
              },
            ].map(action => (
              <Pressable
                key={action.key}
                testID={`lead-menu-${action.key}`}
                disabled={action.disabled}
                onPress={() => {
                  setMenuLead(null);
                  action.onPress();
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: Boolean(action.disabled) }}
                className={`h-14 flex-row items-center gap-3 rounded-control px-3 active:bg-surface-alt ${
                  action.disabled ? 'opacity-50' : ''
                }`}
              >
                <View className="w-6 items-center justify-center">{action.icon}</View>
                <GenieText
                  tone={action.destructive ? 'error' : 'primary'}
                  className="flex-1 font-medium text-base"
                >
                  {action.label}
                </GenieText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </GenieBottomSheet>
    </SafeAreaView>
  );
};
