import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
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
  LocationIcon,
  ScalesIcon,
} from '../../../components/icons/ClientIcons';
import {
  CalendarIcon,
  UsersIcon,
} from '../../../components/icons/LawyerIcons';
import { lawyerApi } from '../../../api/lawyerApi';
import { notificationsApi } from '../../../api/clientApi';
import { chatApi } from '../../../api/chatApi';
import { useUiStore } from '../../../store/uiStore';
import { toAppError } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import type { LawyerClientRow } from '../../../types/lawyer';
import { notSpecified } from '../shared/CaseDetailParts';
import type { LawyerTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useFallbackPoll } from '../../../hooks/useScreenFocused';
import { useT } from '../../../i18n/useT';
import { categoryLabel } from '../../../i18n/labels';

type ClientTab = 'active' | 'inProgress' | 'completed';

export const LawyerClientsScreen: React.FC<
  LawyerTabScreenProps<'Clients'>
> = ({ navigation, route }) => {
  const { t } = useT();
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<ClientTab>(route.params?.tab ?? 'active');

  // Opened from a dashboard shortcut: show the tab it asked for.
  const requestedTab = route.params?.tab;
  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [requestedTab]);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  // Pushed over Socket.IO; polled (while visible) only if the socket is down.
  const pollCases = useFallbackPoll('cases');
  const pollNotifications = useFallbackPoll('notifications');

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
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'clients'] });
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'leads'] });
  };

  const startCaseMutation = useMutation({
    mutationFn: (caseId: string) => lawyerApi.startCase(caseId),
    onError: error => {
      setBusyCaseId(null);
      setActionError(toAppError(error).message);
    },
    onSuccess: settle,
  });

  const completeCaseMutation = useMutation({
    mutationFn: (caseId: string) => lawyerApi.markCaseCompleted(caseId),
    onError: error => {
      setBusyCaseId(null);
      setActionError(toAppError(error).message);
    },
    onSuccess: settle,
  });

  const openChat = async (row: LawyerClientRow) => {
    setActionError(null);
    try {
      const chat = await chatApi.getOrCreateChat(row.clientId);
      (navigation as any).navigate('Chat', {
        chatId: chat._id,
        name: row.name,
        avatar: row.profileImage,
      });
    } catch (error) {
      setActionError(toAppError(error).message);
    }
  };

  const groups = clientsQuery.data;

  const rows: LawyerClientRow[] = useMemo(() => {
    if (!groups) {
      return [];
    }
    const source =
      tab === 'active'
        ? groups.accepted
        : tab === 'inProgress'
        ? groups.inProgress
        : groups.closed;

    const q = search.trim().toLowerCase();
    if (!q) {
      return source;
    }
    return source.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.issue.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q)),
    );
  }, [groups, tab, search]);

  const countFor = (key: ClientTab): number => {
    if (!groups) {
      return 0;
    }
    return key === 'active'
      ? groups.accepted.length
      : key === 'inProgress'
      ? groups.inProgress.length
      : groups.closed.length;
  };

  const openClient = (row: LawyerClientRow) => {
    if (!row.clientId) {
      setActionError(t('lawyer:clients.accountGone'));
      return;
    }
    setActionError(null);
    navigation.navigate('LawyerClientDetails', {
      clientId: String(row.clientId),
      caseId: String(row.caseId),
    });
  };

  const renderActiveCard = (item: LawyerClientRow) => {
    const isBusy = busyCaseId === item.caseId;
    const shortId = item.clientId ? String(item.clientId).slice(-8) : '';

    return (
      <View
        key={item.caseId}
        className="mb-4 rounded-card bg-surface p-4"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <GenieAvatar uri={item.profileImage} name={item.name} size="md" />
            <View className="flex-1">
              <GenieText className="font-bold text-base text-text-primary" numberOfLines={1}>
                {item.name}
              </GenieText>
              {shortId ? (
                <GenieText className="mt-0.5 text-xs text-text-muted font-medium">
                  {t('lawyer:clients.id', { id: shortId })}
                </GenieText>
              ) : null}
            </View>
          </View>

          <View className="rounded-lg border border-info bg-info-surface px-3 py-1">
            <GenieText tone="info" className="font-semibold text-xs">
              {t('lawyer:clients.accepted')}
            </GenieText>
          </View>
        </View>

        <View className="my-3" />

        <View className="gap-2.5">
          <View className="flex-row items-center gap-2.5">
            <GenieText className="text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.category')} <GenieText className="font-medium text-text-primary">{categoryLabel(item.category) || notSpecified()}</GenieText>
            </GenieText>
          </View>

          <View className="flex-row items-center gap-2.5">
            <GenieText className="flex-1 text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.titleLabel')} <GenieText className="font-medium text-text-primary">{item.issue}</GenieText>
            </GenieText>
          </View>

          <View className="flex-row items-center gap-2.5">
            <LocationIcon size={14} color={colors.textMuted} />
            <GenieText className="flex-1 text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.location')} <GenieText className="font-medium text-text-primary">{item.location || notSpecified()}</GenieText>
            </GenieText>
          </View>

          <View className="flex-row items-center gap-2.5">
            <ScalesIcon size={14} color={colors.textMuted} />
            <GenieText className="flex-1 text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.court')} <GenieText className="font-medium text-text-primary">{item.preferredCourt || notSpecified()}</GenieText>
            </GenieText>
          </View>

          <View className="flex-row items-center gap-2.5">
            <CalendarIcon size={14} color={colors.textMuted} />
            <GenieText className="flex-1 text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.acceptedLabel')} <GenieText className="font-medium text-text-primary">{formatDate(item.acceptedAt) || notSpecified()}</GenieText>
            </GenieText>
          </View>
        </View>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            testID={`client-view-${item.caseId}`}
            accessibilityRole="button"
            onPress={() => openClient(item)}
            className="flex-1 items-center justify-center rounded-control border border-border py-2.5 active:bg-gold-muted"
          >
            <GenieText tone="gold" className="font-semibold text-sm">
              {t('lawyer:clients.viewClient')}
            </GenieText>
          </Pressable>

          <Pressable
            disabled={isBusy}
            onPress={() => {
              setActionError(null);
              setBusyCaseId(item.caseId);
              startCaseMutation.mutate(item.caseId);
            }}
            className="flex-1 items-center justify-center rounded-control bg-gold py-2.5 active:bg-gold-hover"
          >
            <GenieText tone="on-gold" className="font-bold text-sm">
              {isBusy ? t('lawyer:clients.starting') : t('lawyer:clients.startCase')}
            </GenieText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderInProgressCard = (item: LawyerClientRow) => {
    const isBusy = busyCaseId === item.caseId;
    const tasksCount = item.tasksRemaining;

    return (
      <View
        key={item.caseId}
        className="mb-4 rounded-card bg-surface p-4"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1 pr-2">
            <GenieAvatar uri={item.profileImage} name={item.name} size="md" />
            <View className="flex-1">
              <GenieText className="font-bold text-base text-text-primary" numberOfLines={1}>
                {item.name}
              </GenieText>
              <GenieText className="mt-0.5 text-xs text-text-secondary" numberOfLines={1}>
                {t('lawyer:clients.caseLine', { title: item.issue })}
              </GenieText>
            </View>
          </View>

          <View className="rounded-lg border border-border bg-warning-surface px-3 py-1">
            <GenieText tone="gold" className="font-semibold text-xs">
              {t('lawyer:clients.inProgress')}
            </GenieText>
          </View>
        </View>

        <View className="my-3" />

        <View className="gap-2.5">
          <View className="flex-row items-center gap-2.5">
            <GenieText className="text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.category')} <GenieText className="font-medium text-text-primary">{categoryLabel(item.category) || notSpecified()}</GenieText>
            </GenieText>
          </View>

          <View className="flex-row items-center gap-2.5">
            <ClockIcon size={14} color={colors.textMuted} />
            <GenieText className="text-xs text-text-secondary" numberOfLines={1}>
              {t('lawyer:clients.lastUpdated')} <GenieText className="font-medium text-text-primary">{formatDate(item.lastActivity)}</GenieText>
            </GenieText>
          </View>

          {typeof tasksCount === 'number' ? (
            <View className="flex-row items-center gap-2.5">
              <GenieText className="text-xs text-text-secondary" numberOfLines={1}>
                {t('lawyer:clients.tasks')} <GenieText className="font-medium text-text-primary">{t('lawyer:clients.tasksRemaining', { count: tasksCount })}</GenieText>
              </GenieText>
            </View>
          ) : null}
        </View>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            testID={`client-view-case-${item.caseId}`}
            accessibilityRole="button"
            onPress={() => openClient(item)}
            className="flex-1 items-center justify-center rounded-control border border-border py-2.5 active:bg-gold-muted"
          >
            <GenieText tone="gold" className="font-semibold text-sm">
              {t('lawyer:clients.viewCase')}
            </GenieText>
          </Pressable>

          <Pressable
            onPress={() => void openChat(item)}
            className="flex-1 items-center justify-center rounded-control border border-border py-2.5 active:bg-gold-muted"
          >
            <GenieText tone="gold" className="font-semibold text-sm">
              {t('lawyer:clients.chat')}
            </GenieText>
          </Pressable>
        </View>

        <Pressable
          disabled={isBusy}
          onPress={() => {
            setActionError(null);
            setBusyCaseId(item.caseId);
            completeCaseMutation.mutate(item.caseId);
          }}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-control bg-success py-3 active:bg-success"
        >
          <GenieText className="font-bold text-sm text-white">
            {isBusy ? t('lawyer:clients.completing') : t('lawyer:clients.markCompleted')}
          </GenieText>
        </Pressable>
      </View>
    );
  };

  const renderCompletedCard = (item: LawyerClientRow) => {
    return (
      <View
        key={item.caseId}
        className="mb-4 rounded-card bg-surface p-4"
      >
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

          <View className="rounded-lg border border-info bg-info-surface px-3 py-1">
            <GenieText tone="info" className="font-semibold text-xs">
              {t('lawyer:clients.completed')}
            </GenieText>
          </View>
        </View>

        <View className="my-3" />

        <GenieText className="text-xs text-text-muted">
          {t('lawyer:clients.completedOn', { date: formatDate(item.lastActivity) })}
        </GenieText>

        <View className="mt-3 flex-row gap-3">
          <Pressable
            testID={`client-view-case-${item.caseId}`}
            accessibilityRole="button"
            onPress={() => openClient(item)}
            className="flex-1 items-center justify-center rounded-control border border-border py-2"
          >
            <GenieText className="font-semibold text-xs text-text-secondary">
              {t('lawyer:clients.viewCase')}
            </GenieText>
          </Pressable>

          <Pressable
            onPress={() => void openChat(item)}
            className="flex-1 items-center justify-center rounded-control border border-border py-2"
          >
            <GenieText className="font-semibold text-xs text-text-secondary">
              {t('lawyer:clients.chat')}
            </GenieText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (clientsQuery.isPending) {
      return (
        <View className="px-4">
          <GenieSkeletonList count={3} />
        </View>
      );
    }

    if (clientsQuery.isError) {
      return (
        <View className="px-4">
          <GenieErrorState
            message={clientsQuery.error.message}
            onRetry={() => clientsQuery.refetch()}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={rows}
        keyExtractor={item => item.caseId}
        contentContainerClassName="px-4 pb-12 pt-1"
        contentContainerStyle={
          rows.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <GenieRefreshControl onRefresh={() => Promise.all([clientsQuery.refetch(), notificationsQuery.refetch()])} />
        }
        renderItem={({ item }) =>
          tab === 'active'
            ? renderActiveCard(item)
            : tab === 'inProgress'
            ? renderInProgressCard(item)
            : renderCompletedCard(item)
        }
        ListEmptyComponent={
          <GenieEmptyState
            icon={<UsersIcon size={28} color={colors.gold} />}
            title={
              search.trim()
                ? t('lawyer:clients.noMatches')
                : tab === 'active'
                ? t('lawyer:clients.noActive')
                : tab === 'inProgress'
                ? t('lawyer:clients.noInProgress')
                : t('lawyer:clients.noCompleted')
            }
            description={
              search.trim()
                ? t('lawyer:clients.nothingMatches', { search })
                : tab === 'active'
                ? t('lawyer:clients.noActiveHint')
                : tab === 'inProgress'
                ? t('lawyer:clients.noInProgressHint')
                : t('lawyer:clients.noCompletedHint')
            }
            actionLabel={search.trim() ? t('lawyer:clients.clearSearch') : undefined}
            onAction={search.trim() ? () => setSearch('') : undefined}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('lawyer:clients.title')}
        onMenu={openDrawer}
        onNotifications={() => (navigation as any).navigate('Notifications')}
        notificationCount={unreadNotificationsCount}
      />

      <GenieFilterTabs
        className="px-4 pt-2"
        testIDPrefix="clients-tab"
        tabs={[
          { key: 'active', label: t('lawyer:clients.active'), count: countFor('active') },
          { key: 'inProgress', label: t('lawyer:clients.inProgress'), count: countFor('inProgress') },
          { key: 'completed', label: t('lawyer:clients.completed'), count: countFor('completed') },
        ]}
        value={tab}
        onChange={setTab}
      />

      <View className="px-4 pb-2 pt-3">
        <GenieSearchInput
          placeholder={t('lawyer:clients.searchPlaceholder')}
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
    </SafeAreaView>
  );
};
