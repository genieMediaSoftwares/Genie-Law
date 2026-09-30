import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import {
  GenieCaseCard,
  GenieEmptyState,
  GenieErrorState,
  GenieFilterTabs,
  GenieHeader,
  GenieSkeletonCard,
  GenieRefreshControl,
} from '../../../components';
import { BriefcaseIcon } from '../../../components/icons/ClientIcons';
import { casesApi } from '../../../api/casesApi';
import { notificationsApi } from '../../../api/clientApi';
import { chatApi } from '../../../api/chatApi';
import { CASE_TABS, matchesTab } from '../../../constants/cases';
import { useUiStore } from '../../../store/uiStore';
import type { CaseTab } from '../../../constants/cases';
import type { LegalCase } from '../../../types/domain';
import type { ClientTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useFallbackPoll } from '../../../hooks/useScreenFocused';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';
import { logError } from '../../../utils/log';

export const MyCasesScreen: React.FC<ClientTabScreenProps<'Cases'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const [tab, setTab] = useState<CaseTab>('All');
  const openDrawer = useUiStore(state => state.openDrawer);
  const openCreateSheet = useUiStore(state => state.openCreateSheet);

  // Pushed over Socket.IO; polled (while visible) only if the socket is down.
  const pollCases = useFallbackPoll('cases');
  const pollNotifications = useFallbackPoll('notifications');

  const casesQuery = useQuery({
    queryKey: ['cases', 'list'],
    queryFn: casesApi.list,
    refetchInterval: pollCases(5000),
    refetchOnWindowFocus: true,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.list(1, 15),
    refetchInterval: pollNotifications(10000),
  });

  const unreadNotificationsCount = notificationsQuery.data?.unreadCount ?? 0;
  const allCases = useMemo(() => casesQuery.data ?? [], [casesQuery.data]);

  const visibleCases = useMemo(
    () => allCases.filter(item => matchesTab(item, tab)),
    [allCases, tab],
  );

  const counts = useMemo(() => {
    const result: Record<CaseTab, number> = {
      All: allCases.length,
      'In Progress': 0,
      Closed: 0,
    };
    for (const item of allCases) {
      if (matchesTab(item, 'In Progress')) {
        result['In Progress'] += 1;
      }
      if (matchesTab(item, 'Closed')) {
        result.Closed += 1;
      }
    }
    return result;
  }, [allCases]);

  const openCase = useCallback(
    (caseId: string) => navigation.navigate('CaseDetails', { caseId }),
    [navigation],
  );

  const handleMessageLawyer = useCallback(
    async (lawyerId: string, lawyerName: string) => {
      try {
        const chat = await chatApi.getOrCreateChat(lawyerId);
        (navigation as any).navigate('Chat', {
          chatId: chat._id,
          name: lawyerName,
        });
      } catch (err) {
        logError('start-chat', err);
      }
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: LegalCase }) => (
      <GenieCaseCard
        item={item}
        onPress={openCase}
        onMessageLawyer={handleMessageLawyer}
      />
    ),
    [openCase, handleMessageLawyer],
  );

  const keyExtractor = useCallback((item: LegalCase) => item._id, []);

  const renderBody = () => {
    if (casesQuery.isPending) {
      return (
        <View className="gap-3 px-4 pt-1">
          <GenieSkeletonCard className="h-44 w-full rounded-card" />
          <GenieSkeletonCard className="h-44 w-full rounded-card" />
          <GenieSkeletonCard className="h-44 w-full rounded-card" />
        </View>
      );
    }

    if (casesQuery.isError) {
      return (
        <View className="px-4 pt-4">
          <GenieErrorState
            message={casesQuery.error.message}
            onRetry={() => casesQuery.refetch()}
          />
        </View>
      );
    }

    const isEmpty = visibleCases.length === 0;

    return (
      <FlatList
        data={visibleCases}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerClassName="px-4 pb-24 pt-1"
        contentContainerStyle={
          isEmpty ? { flexGrow: 1, justifyContent: 'center' } : undefined
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={11}
        removeClippedSubviews
        refreshControl={
          <GenieRefreshControl onRefresh={() => Promise.all([casesQuery.refetch(), notificationsQuery.refetch()])} />
        }
        ListEmptyComponent={
          <GenieEmptyState
            icon={<BriefcaseIcon size={32} color={colors.gold} />}
            title={
              tab === 'All'
                ? t('cases:myCases.emptyAll')
                : tab === 'In Progress'
                ? t('cases:myCases.emptyInProgress')
                : t('cases:myCases.emptyClosed')
            }
            description={
              tab === 'All'
                ? t('cases:myCases.emptyAllHint')
                : tab === 'In Progress'
                ? t('cases:myCases.emptyInProgressHint')
                : t('cases:myCases.emptyClosedHint')
            }
            actionLabel={tab === 'All' ? t('cases:myCases.postFirst') : undefined}
            onAction={tab === 'All' ? openCreateSheet : undefined}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('cases:myCases.title')}
        onMenu={openDrawer}
        onNotifications={() => (navigation as any).navigate('Notifications')}
        notificationCount={unreadNotificationsCount}
      />

      <GenieFilterTabs
        className="px-4 pb-3 pt-2"
        tabs={CASE_TABS.map(item => ({
          key: item,
          label: displayLabel('cases:tabs', item),
          count: casesQuery.isPending ? undefined : counts[item],
        }))}
        value={tab}
        onChange={setTab}
      />

      {renderBody()}
    </SafeAreaView>
  );
};
