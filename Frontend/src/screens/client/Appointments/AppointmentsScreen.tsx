import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieFilterTabs,
  GenieHeader,
  GenieNotice,
  GenieRefreshControl,
  GenieSkeletonList,
  GenieStatusBadge,
  GenieText,
} from '../../../components';
import { CalendarIcon, ClockIcon } from '../../../components/icons/ClientIcons';
import { appointmentsApi } from '../../../api/appointmentsApi';
import { toAppError } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import type { Appointment } from '../../../types/lawyer';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

type Tab = 'upcoming' | 'past';

const isUpcoming = (appointment: Appointment): boolean => {
  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    return false;
  }
  const day = new Date(appointment.date);
  day.setHours(23, 59, 59, 999);
  return day.getTime() >= Date.now();
};

export const AppointmentsScreen: React.FC<
  ClientStackScreenProps<'Appointments'>
> = ({ navigation }) => {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [actionError, setActionError] = useState<string | null>(null);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsApi.list,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => appointmentsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: error => setActionError(toAppError(error).message),
  });

  const all = appointmentsQuery.data;
  const upcoming = useMemo(() => (all ?? []).filter(isUpcoming), [all]);
  const past = useMemo(() => (all ?? []).filter(item => !isUpcoming(item)), [all]);
  const shown = tab === 'upcoming' ? upcoming : past;

  const header = (
    <GenieHeader title={t('client:appointments.title')} onBack={() => navigation.goBack()} />
  );

  const renderItem = ({ item }: { item: Appointment }) => (
    <View className="mb-3 rounded-card bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <GenieAvatar
          uri={item.lawyer?.profileImage}
          name={item.lawyer?.fullName}
          size="md"
        />
        <View className="min-w-0 flex-1">
          <GenieText variant="body" className="font-semibold" numberOfLines={1}>
            {item.lawyer?.fullName ?? t('client:appointments.advocate')}
          </GenieText>
          <GenieText variant="caption" tone="muted">
            {item.mode === 'In-Person' ? t('client:appointments.inPerson') : t('client:appointments.chat')}
          </GenieText>
        </View>
        <GenieStatusBadge status={item.status} />
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          <CalendarIcon size={13} color={colors.gold} />
          <GenieText variant="caption" tone="secondary">
            {formatDate(item.date)}
          </GenieText>
        </View>
        <View className="flex-row items-center gap-1.5">
          <ClockIcon size={13} color={colors.gold} />
          <GenieText variant="caption" tone="secondary">
            {item.timeSlot}
          </GenieText>
        </View>
      </View>

      {item.notes ? (
        <GenieText variant="body-sm" tone="secondary" className="mt-2 leading-5">
          {item.notes}
        </GenieText>
      ) : null}

      {isUpcoming(item) ? (
        <GenieButton
          label={t('client:appointments.cancel')}
          variant="outline"
          loading={cancel.isPending && cancel.variables === item._id}
          onPress={() => {
            setActionError(null);
            cancel.mutate(item._id);
          }}
          className="mt-3"
        />
      ) : null}
    </View>
  );

  const renderBody = () => {
    if (appointmentsQuery.isPending) {
      return (
        <View className="px-4 pt-3">
          <GenieSkeletonList count={3} />
        </View>
      );
    }

    if (appointmentsQuery.isError) {
      return (
        <View className="px-4 pt-3">
          <GenieErrorState
            message={appointmentsQuery.error.message}
            onRetry={() => appointmentsQuery.refetch()}
          />
        </View>
      );
    }

    return (
      <FlatList
        data={shown}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerClassName="px-4 pb-10 pt-1"
        contentContainerStyle={
          shown.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <GenieEmptyState
            title={tab === 'upcoming' ? t('client:appointments.emptyUpcoming') : t('client:appointments.emptyPast')}
            description={
              tab === 'upcoming'
                ? t('client:appointments.emptyUpcomingHint')
                : t('client:appointments.emptyPastHint')
            }
          />
        }
        refreshControl={
          <GenieRefreshControl onRefresh={() => appointmentsQuery.refetch()} />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {header}

      <View className="px-4 pb-2 pt-1">
        <GenieFilterTabs
          tabs={[
            { key: 'upcoming', label: t('client:appointments.upcoming'), count: upcoming.length },
            { key: 'past', label: t('client:appointments.past'), count: past.length },
          ]}
          value={tab}
          onChange={setTab}
          testIDPrefix="appointments-tab"
        />
      </View>

      {actionError ? (
        <View className="px-4 pb-2">
          <GenieNotice tone="error" message={actionError} />
        </View>
      ) : null}

      {renderBody()}
    </SafeAreaView>
  );
};
