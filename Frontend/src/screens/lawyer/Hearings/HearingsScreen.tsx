import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieIconButton,
  GenieModal,
  GenieNotice,
  GenieSearchInput,
  GenieSkeletonList,
  GenieStatusBadge,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import {
  ClockIcon,
  LocationIcon,
  PlusIcon,
  ScalesIcon,
} from '../../../components/icons/ClientIcons';
import { UsersIcon } from '../../../components/icons/LawyerIcons';
import { lawyerApi } from '../../../api/lawyerApi';
import { toAppError } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import { HearingFormModal } from './HearingFormModal';
import type { HearingInput, LawyerHearing } from '../../../types/lawyer';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import i18n from '../../../i18n';
import { categoryLabel, displayLabel } from '../../../i18n/labels';

type HearingTab = 'today' | 'upcoming' | 'past';

const startOfToday = (): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

const endOfToday = (): number => startOfToday() + 24 * 60 * 60 * 1000 - 1;

const bucketOf = (hearing: LawyerHearing): HearingTab => {
  const time = new Date(hearing.date).getTime();
  if (Number.isNaN(time)) {
    return 'upcoming';
  }
  if (time < startOfToday()) {
    return 'past';
  }
  if (time <= endOfToday()) {
    return 'today';
  }
  return 'upcoming';
};

const HearingCard: React.FC<{
  hearing: LawyerHearing;
  onPress: () => void;
}> = ({ hearing, onPress }) => {
  useT(); // re-render on language change
  return (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${hearing.caseTitle}, ${formatDate(hearing.date)}`}
    className="mb-3 rounded-card bg-card p-4 active:opacity-90"
  >
    <View className="flex-row items-start justify-between">
      <GenieText variant="heading-sm" className="flex-1 pr-2" numberOfLines={2}>
        {hearing.caseTitle}
      </GenieText>
      {hearing.status ? <GenieStatusBadge status={hearing.status} /> : null}
    </View>

    <View className="mt-3 gap-1.5">
      <View className="flex-row items-center gap-2">
        <ClockIcon size={14} color={colors.gold} />
        <GenieText variant="body-sm" tone="secondary">
          {[formatDate(hearing.date), hearing.timeSlot]
            .filter(Boolean)
            .join(' · ')}
        </GenieText>
      </View>

      {hearing.clientName ? (
        <View className="flex-row items-center gap-2">
          <UsersIcon size={14} color={colors.textMuted} />
          <GenieText variant="body-sm" tone="secondary" numberOfLines={1}>
            {hearing.clientName}
          </GenieText>
        </View>
      ) : null}

      {hearing.court ? (
        <View className="flex-row items-center gap-2">
          <LocationIcon size={14} color={colors.textMuted} />
          <GenieText variant="body-sm" tone="secondary" numberOfLines={1}>
            {hearing.court}
          </GenieText>
        </View>
      ) : null}

      {hearing.purpose ? (
        <View className="flex-row items-center gap-2">
          <ScalesIcon size={14} color={colors.textMuted} />
          <GenieText variant="body-sm" tone="secondary" numberOfLines={1}>
            {hearing.purpose}
          </GenieText>
        </View>
      ) : null}
    </View>
  </Pressable>
  );
};

export const HearingsScreen: React.FC<LawyerStackScreenProps<'Hearings'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<HearingTab>('today');
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<LawyerHearing | null>(null);
  const [detail, setDetail] = useState<LawyerHearing | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LawyerHearing | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hearingsQuery = useQuery({
    queryKey: ['lawyer', 'hearings'],
    queryFn: lawyerApi.getHearings,
  });

  const clientsQuery = useQuery({
    queryKey: ['lawyer', 'clients'],
    queryFn: lawyerApi.getClients,
  });

  const cases = useMemo(() => {
    const groups = clientsQuery.data;
    if (!groups) {
      return [];
    }
    return [...groups.accepted, ...groups.inProgress, ...groups.closed];
  }, [clientsQuery.data]);

  const settle = async () => {
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'hearings'] });
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'clients'] });
    await queryClient.invalidateQueries({ queryKey: ['lawyer', 'schedule'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (vars: { caseId: string; payload: HearingInput }) => {
      if (editing?._id) {
        await lawyerApi.updateHearing(vars.caseId, editing._id, vars.payload);
      } else {
        await lawyerApi.addHearing(vars.caseId, vars.payload);
      }
    },
    onSuccess: async () => {
      setIsFormOpen(false);
      setEditing(null);
      setFormError(null);
      await settle();
    },
    onError: error => setFormError(toAppError(error).message),
  });

  const statusMutation = useMutation({
    mutationFn: async (vars: {
      hearing: LawyerHearing;
      status: HearingInput['status'];
    }) => {
      if (!vars.hearing._id) {
        throw new Error(i18n.t('lawyer:hearings.noIdUpdate'));
      }
      await lawyerApi.updateHearing(vars.hearing.caseId, vars.hearing._id, {
        status: vars.status,
      });
    },
    onSuccess: async () => {
      setDetail(null);
      await settle();
    },
    onError: error => setActionError(toAppError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (hearing: LawyerHearing) => {
      if (!hearing._id) {
        throw new Error(i18n.t('lawyer:hearings.noIdDelete'));
      }
      await lawyerApi.deleteHearing(hearing.caseId, hearing._id);
    },
    onSuccess: async () => {
      setPendingDelete(null);
      setDetail(null);
      await settle();
    },
    onError: error => {
      setPendingDelete(null);
      setActionError(toAppError(error).message);
    },
  });

  const hearings = useMemo(
    () => hearingsQuery.data ?? [],
    [hearingsQuery.data],
  );

  const counts = useMemo(() => {
    const result = { today: 0, upcoming: 0, past: 0 };
    for (const hearing of hearings) {
      result[bucketOf(hearing)] += 1;
    }
    return result;
  }, [hearings]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hearings
      .filter(h => bucketOf(h) === tab)
      .filter(
        h =>
          !q ||
          h.caseTitle.toLowerCase().includes(q) ||
          h.clientName.toLowerCase().includes(q) ||
          (h.court ?? '').toLowerCase().includes(q) ||
          (h.purpose ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const left = new Date(a.date).getTime();
        const right = new Date(b.date).getTime();
        return tab === 'past' ? right - left : left - right;
      });
  }, [hearings, search, tab]);

  const renderBody = () => {
    if (hearingsQuery.isPending) {
      return <GenieSkeletonList count={3} />;
    }

    if (hearingsQuery.isError) {
      return (
        <GenieErrorState
          message={hearingsQuery.error.message}
          onRetry={() => hearingsQuery.refetch()}
        />
      );
    }

    if (visible.length === 0) {
      return (
        <GenieEmptyState
          icon={<ScalesIcon size={28} color={colors.gold} />}
          title={
            search.trim()
              ? t('lawyer:hearings.noMatches')
              : tab === 'today'
              ? t('lawyer:hearings.nothingToday')
              : tab === 'upcoming'
              ? t('lawyer:hearings.noUpcoming')
              : t('lawyer:hearings.noPast')
          }
          description={
            search.trim()
              ? t('lawyer:hearings.nothingMatches', { search })
              : t('lawyer:hearings.emptyHint')
          }
          actionLabel={search.trim() ? t('lawyer:hearings.clearSearch') : undefined}
          onAction={search.trim() ? () => setSearch('') : undefined}
        />
      );
    }

    return visible.map(hearing => (
      <HearingCard
        key={`${hearing.caseId}-${hearing._id ?? hearing.date}`}
        hearing={hearing}
        onPress={() => {
          setActionError(null);
          setDetail(hearing);
        }}
      />
    ));
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('lawyer:hearings.title')}
        onBack={() => navigation.goBack()}
        right={
          <GenieIconButton
            icon={<PlusIcon size={22} color={colors.gold} />}
            accessibilityLabel={t('lawyer:hearings.addA11y')}
            onPress={() => {
              setEditing(null);
              setFormError(null);
              setIsFormOpen(true);
            }}
          />
        }
      />

      <View className="px-4 pb-2 pt-1">
        <GenieSearchInput
          placeholder={t('lawyer:hearings.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      <View className="flex-row gap-2 px-4 pb-3">
        {(
          [
            ['today', t('lawyer:hearings.today'), counts.today],
            ['upcoming', t('lawyer:hearings.upcoming'), counts.upcoming],
            ['past', t('lawyer:hearings.past'), counts.past],
          ] as const
        ).map(([key, label, count]) => (
          <View key={key} className="flex-1">
            <GenieButton
              label={t('lawyer:hearings.tabCount', { label, count })}
              variant={tab === key ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setTab(key)}
            />
          </View>
        ))}
      </View>

      {actionError ? (
        <View className="px-4 pb-2">
          <GenieNotice tone="error" message={actionError} />
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <GenieRefreshControl onRefresh={() => hearingsQuery.refetch()} />
        }
      >
        {renderBody()}
      </ScrollView>

      <HearingFormModal
        visible={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
        }}
        hearing={editing}
        cases={cases}
        isSaving={saveMutation.isPending}
        error={formError}
        onSubmit={(caseId, payload) =>
          saveMutation.mutate({ caseId, payload })
        }
      />

      <GenieModal
        visible={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={t('lawyer:hearings.hearing')}
      >
        {detail ? (
          <ScrollView className="max-h-[400px]" showsVerticalScrollIndicator={false}>
            <GenieText variant="heading-sm">{detail.caseTitle}</GenieText>

            <View className="mt-3 gap-2">
              {(
                [
                  [t('lawyer:hearings.client'), detail.clientName],
                  [t('lawyer:hearings.date'), formatDate(detail.date)],
                  [t('lawyer:hearings.time'), detail.timeSlot],
                  [t('lawyer:hearings.court'), detail.court],
                  [t('lawyer:hearings.purpose'), detail.purpose],
                  [t('lawyer:hearings.status'), displayLabel('cases:status', detail.status)],
                  [t('lawyer:hearings.caseStatus'), displayLabel('cases:status', detail.caseStatus)],
                  [t('lawyer:hearings.category'), categoryLabel(detail.caseCategory)],
                  [t('lawyer:hearings.notes'), detail.notes],
                  [
                    t('lawyer:hearings.lastUpdated'),
                    detail.updatedAt ? formatDate(detail.updatedAt) : '',
                  ],
                ] as const
              )
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <View key={label} className="pb-1.5">
                    <GenieText variant="caption" tone="muted">
                      {label}
                    </GenieText>
                    <GenieText variant="body-md" className="mt-0.5">
                      {String(value)}
                    </GenieText>
                  </View>
                ))}
            </View>

            <View className="mt-4 gap-3">
              <GenieButton
                label={t('lawyer:hearings.editReschedule')}
                variant="outline"
                onPress={() => {
                  setEditing(detail);
                  setDetail(null);
                  setFormError(null);
                  setIsFormOpen(true);
                }}
              />

              {detail.status !== 'completed' ? (
                <GenieButton
                  label={t('lawyer:hearings.markCompleted')}
                  loading={statusMutation.isPending}
                  onPress={() =>
                    statusMutation.mutate({
                      hearing: detail,
                      status: 'completed',
                    })
                  }
                />
              ) : null}

              {detail.status !== 'cancelled' ? (
                <GenieButton
                  label={t('lawyer:hearings.cancelHearing')}
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onPress={() =>
                    statusMutation.mutate({
                      hearing: detail,
                      status: 'cancelled',
                    })
                  }
                />
              ) : null}

              <GenieButton
                label={t('lawyer:hearings.delete')}
                variant="danger"
                onPress={() => setPendingDelete(detail)}
              />
            </View>
          </ScrollView>
        ) : null}
      </GenieModal>

      <GenieModal
        visible={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={t('lawyer:hearings.deleteTitle')}
      >
        <GenieText variant="body-md" tone="secondary">
          {t('lawyer:hearings.deleteMessage')}
        </GenieText>

        <View className="mt-5 flex-row gap-3">
          <GenieButton
            label={t('lawyer:hearings.keep')}
            variant="outline"
            onPress={() => setPendingDelete(null)}
            className="flex-1"
          />
          <GenieButton
            label={t('lawyer:hearings.delete')}
            variant="danger"
            loading={deleteMutation.isPending}
            onPress={() => {
              if (pendingDelete) {
                deleteMutation.mutate(pendingDelete);
              }
            }}
            className="flex-1"
          />
        </View>
      </GenieModal>
    </SafeAreaView>
  );
};
