import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieModal,
  GenieNotice,
  GenieSearchInput,
  GenieSkeletonList,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import {
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  SparkleIcon,
  TrashIcon,
} from '../../../components/icons/ClientIcons';
import { aiApi } from '../../../api/aiApi';
import { toAppError } from '../../../utils/errors';
import { formatRelative } from '../../../utils/format';
import type { ResearchSession } from '../../../types/lawyer';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

export const ResearchScreen: React.FC<LawyerStackScreenProps<'Research'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ResearchSession | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['lawyer', 'research', 'sessions'],
    queryFn: aiApi.getResearchSessions,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: async () => {
      setPendingDelete(null);
      await queryClient.invalidateQueries({
        queryKey: ['lawyer', 'research', 'sessions'],
      });
    },
    onError: error => {
      setPendingDelete(null);
      setActionError(toAppError(error).message);
    },
  });

  const sessions = useMemo(
    () => sessionsQuery.data ?? [],
    [sessionsQuery.data],
  );

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return sessions;
    }
    return sessions.filter(
      s =>
        s.title.toLowerCase().includes(q) ||
        s.lastMessage.toLowerCase().includes(q),
    );
  }, [search, sessions]);

  const openBlank = () =>
    navigation.navigate('ResearchSession', { sessionId: undefined });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader title={t('lawyer:research.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 pt-3"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <GenieRefreshControl onRefresh={() => sessionsQuery.refetch()} />
        }
      >
        <View className="rounded-card border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-gold-muted">
              <SparkleIcon size={22} color={colors.gold} />
            </View>
            <View className="flex-1">
              <GenieText variant="heading-md">{t('lawyer:research.aiTitle')}</GenieText>
              <GenieText variant="body-sm" tone="secondary" className="mt-0.5">
                {t('lawyer:research.aiIntro')}
              </GenieText>
            </View>
          </View>

          <View className="mt-4 gap-3">
            <GenieButton
              label={t('lawyer:research.start')}
              onPress={openBlank}
              icon={<SparkleIcon size={18} color={colors.onGold} />}
            />

            <GenieButton
              label={t('lawyer:research.existingCase')}
              variant="outline"
              onPress={() => navigation.navigate('ResearchCases')}
              icon={<FileIcon size={18} color={colors.gold} />}
            />
          </View>

          <GenieText variant="caption" tone="muted" className="mt-3 leading-4">
            {t('lawyer:research.disclaimer')}
          </GenieText>
        </View>

        {actionError ? (
          <GenieNotice tone="error" message={actionError} className="mt-4" />
        ) : null}

        <View className="mt-6 flex-row items-end justify-between">
          <GenieText variant="heading-sm">{t('lawyer:research.yours')}</GenieText>
          {sessions.length > 0 ? (
            <GenieText variant="caption" tone="muted">
              {t('lawyer:research.sessions', { count: sessions.length })}
            </GenieText>
          ) : null}
        </View>

        {sessions.length > 0 ? (
          <View className="mt-3">
            <GenieSearchInput
              placeholder={t('lawyer:research.searchPlaceholder')}
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
            />
          </View>
        ) : null}

        <View className="mt-3">
          {sessionsQuery.isPending ? (
            <GenieSkeletonList count={3} />
          ) : sessionsQuery.isError ? (
            <GenieErrorState
              message={sessionsQuery.error.message}
              onRetry={() => sessionsQuery.refetch()}
            />
          ) : filteredSessions.length === 0 ? (
            <GenieEmptyState
              icon={<SparkleIcon size={28} color={colors.gold} />}
              title={
                search.trim() ? t('lawyer:research.noMatches') : t('lawyer:research.none')
              }
              description={
                search.trim()
                  ? t('lawyer:research.nothingMatches', { search })
                  : t('lawyer:research.noneHint')
              }
              actionLabel={search.trim() ? t('lawyer:research.clearSearch') : t('lawyer:research.start')}
              onAction={
                search.trim() ? () => setSearch('') : openBlank
              }
            />
          ) : (
            filteredSessions.map(session => (
              <View
                key={session.id}
                className="mb-3 flex-row items-center rounded-card border border-border bg-card"
              >
                <Pressable
                  onPress={() =>
                    navigation.navigate('ResearchSession', {
                      sessionId: session.id,
                      title: session.title,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('lawyer:research.openA11y', { title: session.title })}
                  className="min-h-touch flex-1 flex-row items-center gap-3 p-4 active:opacity-80"
                >
                  <View className="flex-1">
                    <GenieText variant="body-lg" numberOfLines={1}>
                      {session.title}
                    </GenieText>

                    {session.lastMessage ? (
                      <GenieText
                        variant="body-sm"
                        tone="secondary"
                        numberOfLines={2}
                        className="mt-0.5"
                      >
                        {session.lastMessage}
                      </GenieText>
                    ) : null}

                    <View className="mt-1.5 flex-row items-center gap-1.5">
                      <ClockIcon size={12} color={colors.textMuted} />
                      <GenieText variant="caption" tone="muted">
                        {t('lawyer:research.updated', {
                          time: formatRelative(session.updatedAt),
                          count: session.messageCount,
                        })}
                      </GenieText>
                    </View>
                  </View>

                  <ChevronRightIcon size={18} color={colors.textSecondary} />
                </Pressable>

                <Pressable
                  onPress={() => {
                    setActionError(null);
                    setPendingDelete(session);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('lawyer:research.deleteA11y', { title: session.title })}
                  className="min-h-touch min-w-touch items-center justify-center pr-3 active:opacity-70"
                >
                  <TrashIcon size={18} color={colors.error} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <GenieModal
        visible={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={t('lawyer:research.deleteTitle')}
      >
        <GenieText variant="body-md" tone="secondary">
          {pendingDelete
            ? t('lawyer:research.deleteMessage', { title: pendingDelete.title })
            : ''}
        </GenieText>

        <View className="mt-5 flex-row gap-3">
          <GenieButton
            label={t('lawyer:research.keep')}
            variant="outline"
            onPress={() => setPendingDelete(null)}
            className="flex-1"
          />
          <GenieButton
            label={t('lawyer:research.delete')}
            variant="danger"
            loading={deleteMutation.isPending}
            onPress={() => {
              if (pendingDelete) {
                deleteMutation.mutate(pendingDelete.id);
              }
            }}
            className="flex-1"
          />
        </View>
      </GenieModal>
    </SafeAreaView>
  );
};
