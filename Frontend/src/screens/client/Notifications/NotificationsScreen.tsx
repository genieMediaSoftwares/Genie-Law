import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  GenieErrorState,
  GenieSkeleton,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import { BellIcon, TrashIcon } from '../../../components/icons/ClientIcons';
import { BackIcon, MailIcon } from '../../../components/icons/Icons';
import { notificationsApi } from '../../../api/clientApi';
import {
  NotificationCategoryTabs,
} from '../../../components/notifications/NotificationCategoryTabs';
import { NotificationCard } from '../../../components/notifications/NotificationCard';
import type { NotificationCategory } from '../../../components/notifications/NotificationCategoryTabs';
import type { AppNotification } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useFallbackPoll } from '../../../hooks/useScreenFocused';
import { useT } from '../../../i18n/useT';

const PAGE_SIZE = 15;

const isCaseNotification = (type: string) =>
  [
    'case_posted',
    'proposal_received',
    'proposal_accepted',
    'proposal_rejected',
    'case_status_updated',
  ].includes(type);

const isMessageNotification = (type: string) => type === 'chat_message';

const isDocumentNotification = (type: string) => type === 'document_uploaded';

const matchesCategory = (item: AppNotification, tab: NotificationCategory): boolean => {
  if (tab === 'All') return true;
  if (tab === 'Cases') return isCaseNotification(item.type);
  if (tab === 'Messages') return isMessageNotification(item.type);
  if (tab === 'Documents') return isDocumentNotification(item.type);
  return (
    !isCaseNotification(item.type) &&
    !isMessageNotification(item.type) &&
    !isDocumentNotification(item.type)
  );
};

export const NotificationsScreen: React.FC<
  ClientStackScreenProps<'Notifications'>
> = ({ navigation }) => {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<NotificationCategory>('All');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pushed over Socket.IO; polled (while visible) only if the socket is down.
  const pollNotifications = useFallbackPoll('notifications');

  const query = useInfiniteQuery({
    queryKey: ['notifications', 'infinite'],
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const { page, pages } = lastPage.pagination;
      return page < pages ? page + 1 : undefined;
    },
    refetchInterval: pollNotifications(3000),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  const allItems = useMemo(
    () => (query.data?.pages ?? []).flatMap(page => page.notifications),
    [query.data],
  );

  const filteredItems = useMemo(
    () => allItems.filter(item => matchesCategory(item, tab)),
    [allItems, tab],
  );

  const counts = useMemo(() => {
    const result: Record<NotificationCategory, number> = {
      All: 0,
      Cases: 0,
      Messages: 0,
      Documents: 0,
      Updates: 0,
    };
    for (const item of allItems) {
      if (!item.isRead) {
        result.All += 1;
        if (isCaseNotification(item.type)) result.Cases += 1;
        else if (isMessageNotification(item.type)) result.Messages += 1;
        else if (isDocumentNotification(item.type)) result.Documents += 1;
        else result.Updates += 1;
      }
    }
    return result;
  }, [allItems]);

  const settleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSettled: settleQueries,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSettled: settleQueries,
  });

  const deleteNotification = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSettled: settleQueries,
  });

  const clearAllNotifications = useMutation({
    mutationFn: notificationsApi.clearAll,
    onSettled: () => {
      setSelectedIds([]);
      setIsSelectMode(false);
      settleQueries();
    },
  });

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i._id));
    }
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedIds) {
      await notificationsApi.remove(id);
    }
    setSelectedIds([]);
    setIsSelectMode(false);
    settleQueries();
  };

  const handleMarkSelectedRead = async () => {
    for (const id of selectedIds) {
      await notificationsApi.markRead(id);
    }
    setSelectedIds([]);
    setIsSelectMode(false);
    settleQueries();
  };

  const handleNotificationPress = useCallback(
    (item: AppNotification) => {
      if (!item.isRead) {
        markRead.mutate(item._id);
      }

      if (isCaseNotification(item.type) && item.referenceId) {
        (navigation as any).navigate('CaseDetails', { caseId: item.referenceId });
      } else if (isMessageNotification(item.type)) {
        if (item.referenceId) {
          (navigation as any).navigate('Chat', { chatId: item.referenceId });
        } else {
          (navigation as any).navigate('Messages');
        }
      } else if (isDocumentNotification(item.type)) {
        (navigation as any).navigate('Documents');
      } else if (item.type.startsWith('appointment_') || item.type === 'reminder') {
        (navigation as any).navigate('Calendar');
      } else if (item.type.startsWith('payment_') || item.type === 'profile_verification') {
        (navigation as any).navigate('Profile');
      }
    },
    [markRead, navigation],
  );

  const isEmpty = filteredItems.length === 0;

  const renderBody = () => {
    if (query.isPending) {
      return (
        <View className="mt-1 gap-3 px-4 max-w-3xl mx-auto w-full">
          <GenieSkeleton className="h-24 w-full rounded-card" />
          <GenieSkeleton className="h-24 w-full rounded-card" />
          <GenieSkeleton className="h-24 w-full rounded-card" />
        </View>
      );
    }

    if (query.isError) {
      return (
        <View className="px-4 max-w-3xl mx-auto w-full">
          <GenieErrorState
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={filteredItems}
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            isSelectMode={isSelectMode}
            isSelected={selectedIds.includes(item._id)}
            onToggleSelect={() => handleToggleSelect(item._id)}
            onPress={() => handleNotificationPress(item)}
            onMarkRead={() => markRead.mutate(item._id)}
            onDelete={() => deleteNotification.mutate(item._id)}
          />
        )}
        keyExtractor={item => item._id}
        contentContainerClassName="px-4 pb-20 pt-1 max-w-3xl mx-auto w-full"
        contentContainerStyle={
          isEmpty ? { flexGrow: 1, justifyContent: 'center' } : undefined
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="items-center py-3">
              <GenieText className="text-xs text-text-muted">
                {t('notifications:screen.loadingMore')}
              </GenieText>
            </View>
          ) : undefined
        }
        refreshControl={
          <GenieRefreshControl onRefresh={() => query.refetch()} />
        }
        ListEmptyComponent={
          <View className="items-center rounded-card border-2 border-dashed border-border bg-surface-alt p-8 my-6">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-alt">
              <BellIcon size={24} color={colors.gold} />
            </View>
            <GenieText className="font-bold text-base text-text-primary">
              {t('notifications:screen.caughtUp')}
            </GenieText>
            <GenieText className="mt-1 text-center text-xs text-text-secondary">
              {t('notifications:screen.caughtUpHint')}
            </GenieText>
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="max-w-3xl mx-auto w-full flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="p-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.goBack')}
        >
          <BackIcon size={20} color={colors.gold} />
        </Pressable>

        <GenieText className="font-bold text-lg text-text-primary">
          {t('notifications:screen.title')}
        </GenieText>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedIds([]);
            }}
            className="active:opacity-70"
          >
            <GenieText tone="gold" className="font-bold text-xs">
              {isSelectMode ? t('notifications:screen.done') : t('notifications:screen.select')}
            </GenieText>
          </Pressable>

          {!isSelectMode ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              disabled={markAllRead.isPending || counts.All === 0}
              className="active:opacity-70"
            >
              <GenieText tone="gold" className="font-bold text-xs">
                {markAllRead.isPending ? t('notifications:screen.marking') : t('notifications:screen.markAllRead')}
              </GenieText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="max-w-3xl mx-auto w-full">
        <NotificationCategoryTabs
          selectedTab={tab}
          onSelectTab={setTab}
          counts={counts}
        />
      </View>

      {isSelectMode ? (
        <View className="max-w-3xl mx-auto w-full flex-row items-center justify-between px-4 py-2 bg-surface-alt mb-2">
          <Pressable
            onPress={handleSelectAllToggle}
            className="px-2 py-1"
          >
            <GenieText tone="gold" className="font-semibold text-xs">
              {selectedIds.length === filteredItems.length
                ? t('notifications:screen.deselectAll')
                : t('notifications:screen.selectAll')}
            </GenieText>
          </Pressable>

          <GenieText className="font-medium text-xs text-text-muted">
            {t('notifications:screen.selectedCount', { count: selectedIds.length })}
          </GenieText>

          <Pressable
            onPress={() => clearAllNotifications.mutate()}
            disabled={clearAllNotifications.isPending || allItems.length === 0}
            className="px-2 py-1"
          >
            <GenieText tone="error" className="font-semibold text-xs">
              {t('notifications:screen.clearAll')}
            </GenieText>
          </Pressable>
        </View>
      ) : null}

      {renderBody()}

      {isSelectMode && selectedIds.length > 0 ? (
        <View className="absolute bottom-4 left-4 right-4 max-w-3xl mx-auto flex-row gap-3 rounded-card border border-border bg-surface p-3">
          <Pressable
            onPress={handleMarkSelectedRead}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-control border border-border py-2.5 active:bg-gold-muted"
          >
            <MailIcon size={16} color={colors.gold} />
            <GenieText tone="gold" className="font-semibold text-xs">
              {t('notifications:screen.markReadCount', { count: selectedIds.length })}
            </GenieText>
          </Pressable>

          <Pressable
            onPress={handleDeleteSelected}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-control bg-error py-2.5 active:opacity-80"
          >
            <TrashIcon size={16} color={colors.white} />
            <GenieText className="font-bold text-xs text-white">
              {t('notifications:screen.deleteCount', { count: selectedIds.length })}
            </GenieText>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
};
