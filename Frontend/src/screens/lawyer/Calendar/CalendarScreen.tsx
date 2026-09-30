import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieCard,
  GenieErrorState,
  GenieHeader,
  GenieNotice,
  GenieScreen,
  GenieSkeleton,
  GenieStatusBadge,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import { ChevronDownIcon } from '../../../components/icons/Icons';
import { ChevronRightIcon, ClockIcon, PlusIcon } from '../../../components/icons/ClientIcons';
import { CalendarIcon, ChevronLeftIcon } from '../../../components/icons/LawyerIcons';
import { lawyerApi } from '../../../api/lawyerApi';
import { useUiStore } from '../../../store/uiStore';
import { toAppError } from '../../../utils/errors';
import type { Appointment, LawyerClientRow } from '../../../types/lawyer';
import type { LawyerTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { formatDate, formatDateParts } from '../../../utils/format';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

// Weekday and month names come from Intl in the current language.
// 7 Jan 2024 was a Sunday, so day i of that week is weekday i.
const weekdayName = (index: number): string =>
  formatDateParts(new Date(2024, 0, 7 + index), { weekday: 'short' });
const WEEKDAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

export const CalendarScreen: React.FC<LawyerTabScreenProps<'Calendar'>> = () => {
  const { t } = useT();
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();

  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = useState(() => dayKey(today));
  const [selectedDateObj, setSelectedDateObj] = useState<Date>(() => today);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<LawyerClientRow | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('11:00 AM');
  const [consultationMode, setConsultationMode] = useState<'Chat' | 'In-Person'>('Chat');

  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isModePickerOpen, setIsModePickerOpen] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const appointmentsQuery = useQuery({
    queryKey: ['lawyer', 'appointments'],
    queryFn: lawyerApi.getAppointments,
  });

  const clientsQuery = useQuery({
    queryKey: ['lawyer', 'clients'],
    queryFn: lawyerApi.getClients,
  });

  const clientList = useMemo(() => {
    if (!clientsQuery.data) return [];
    const list = [
      ...clientsQuery.data.accepted,
      ...clientsQuery.data.inProgress,
      ...clientsQuery.data.closed,
    ];
    const seen = new Set<string>();
    return list.filter(c => {
      if (seen.has(c.clientId)) return false;
      seen.add(c.clientId);
      return true;
    });
  }, [clientsQuery.data]);

  const createAppointmentMutation = useMutation({
    mutationFn: (payload: {
      client: string;
      date: string;
      timeSlot: string;
      mode: 'Chat' | 'In-Person';
    }) => lawyerApi.createAppointment(payload),
    onError: error => {
      setFormError(toAppError(error).message);
    },
    onSuccess: async () => {
      setIsAddModalOpen(false);
      setFormError(null);
      await queryClient.invalidateQueries({
        queryKey: ['lawyer', 'appointments'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['lawyer', 'schedule', 'today'],
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Appointment['status'];
    }) => lawyerApi.updateAppointmentStatus(id, status),
    onError: error => {
      setBusyId(null);
      setActionError(toAppError(error).message);
    },
    onSuccess: async () => {
      setBusyId(null);
      await queryClient.invalidateQueries({
        queryKey: ['lawyer', 'appointments'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['lawyer', 'schedule', 'today'],
      });
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointmentsQuery.data ?? []) {
      const key = dayKey(new Date(appt.date));
      const list = map.get(key);
      if (list) {
        list.push(appt);
      } else {
        map.set(key, [appt]);
      }
    }
    return map;
  }, [appointmentsQuery.data]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<number | null> = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedAppointments = byDay.get(selectedKey) ?? [];

  // Days before today cannot be chosen, and months before this one cannot be opened.
  const todayKey = dayKey(today);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const shiftMonth = (delta: number) => {
    if (delta < 0 && isCurrentMonth) {
      return;
    }
    setViewDate(new Date(year, month + delta, 1));
  };

  const handleOpenAddModal = () => {
    setFormError(null);
    if (!selectedClient && clientList.length > 0) {
      setSelectedClient(clientList[0]);
    }
    setIsAddModalOpen(true);
  };

  const handleAddAppointment = () => {
    if (!selectedClient) {
      setFormError(t('lawyer:calendar.selectClientError'));
      return;
    }

    createAppointmentMutation.mutate({
      client: selectedClient.clientId,
      date: dayKey(selectedDateObj),
      timeSlot: selectedTimeSlot,
      mode: consultationMode,
    });
  };

  const headerRight = (
    <Pressable
      onPress={handleOpenAddModal}
      accessibilityRole="button"
      accessibilityLabel={t('lawyer:calendar.addA11y')}
      className="h-10 w-10 items-center justify-center rounded-full bg-gold active:bg-gold-pressed"
    >
      <PlusIcon size={20} color={colors.onGold} />
    </Pressable>
  );

  return (
    <GenieScreen
      scrollable
      dismissKeyboardOnTap={false}
      header={
        <GenieHeader
          title={t('lawyer:calendar.title')}
          onMenu={openDrawer}
          right={headerRight}
        />
      }
      contentContainerClassName="pb-20 px-4"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={() => Promise.all([appointmentsQuery.refetch(), clientsQuery.refetch()])} />
        ),
      }}
    >
      <View className="mt-2 rounded-card bg-card p-4">
        <View className="flex-row items-center justify-between px-2 py-1">
          <Pressable
            onPress={() => shiftMonth(-1)}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel={t('lawyer:calendar.prevMonth')}
            accessibilityState={{ disabled: isCurrentMonth }}
            className={`p-1 active:opacity-70 ${isCurrentMonth ? 'opacity-30' : ''}`}
          >
            <ChevronLeftIcon size={20} color={colors.white} />
          </Pressable>

          <GenieText variant="heading-sm" className="font-bold text-white">
            {formatDateParts(viewDate, { month: 'long', year: 'numeric' })}
          </GenieText>

          <Pressable
            onPress={() => shiftMonth(1)}
            accessibilityRole="button"
            accessibilityLabel={t('lawyer:calendar.nextMonth')}
            className="p-1 active:opacity-70"
          >
            <ChevronRightIcon size={20} color={colors.white} />
          </Pressable>
        </View>

        <View className="mt-4 flex-row justify-between pb-2">
          {WEEKDAY_INDEXES.map(i => (
            <View key={`weekday-${i}`} className="w-[14.28%] items-center">
              <GenieText variant="caption" tone="secondary" className="font-medium text-xs">
                {weekdayName(i)}
              </GenieText>
            </View>
          ))}
        </View>

        <View className="mt-2 flex-row flex-wrap">
          {cells.map((day, index) => {
            if (day === null) {
              return <View key={`blank-${index}`} className="h-11 w-[14.28%]" />;
            }

            const cellDate = new Date(year, month, day);
            const key = dayKey(cellDate);
            const isSelected = key === selectedKey;
            const hasEvents = byDay.has(key);
            // dayKey is YYYY-MM-DD, so string order is date order.
            const isPast = key < todayKey;

            return (
              <Pressable
                key={key}
                disabled={isPast}
                onPress={() => {
                  setSelectedKey(key);
                  setSelectedDateObj(cellDate);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isPast }}
                accessibilityLabel={
                  hasEvents
                    ? t('lawyer:calendar.hasAppointments', {
                        date: formatDateParts(cellDate, { day: 'numeric', month: 'long', year: 'numeric' }),
                      })
                    : formatDateParts(cellDate, { day: 'numeric', month: 'long', year: 'numeric' })
                }
                className="h-11 w-[14.28%] items-center justify-center"
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    isSelected ? 'bg-gold' : ''
                  }`}
                >
                  <GenieText
                    variant="body-sm"
                    tone={isSelected ? 'on-gold' : isPast ? 'muted' : 'primary'}
                    className={isSelected ? 'font-bold' : isPast ? 'font-normal opacity-40' : 'font-normal'}
                  >
                    {String(day)}
                  </GenieText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <GenieText variant="heading-sm" className="mt-6 mb-3 font-bold text-white">
        {t('lawyer:calendar.appointments')}
      </GenieText>

      {actionError ? (
        <GenieNotice message={actionError} className="mb-4" />
      ) : null}

      {appointmentsQuery.isLoading ? (
        <View className="gap-3">
          <GenieSkeleton className="h-24 w-full rounded-card" />
        </View>
      ) : appointmentsQuery.isError ? (
        <GenieErrorState
          message={(appointmentsQuery.error as Error).message}
          onRetry={() => appointmentsQuery.refetch()}
        />
      ) : selectedAppointments.length === 0 ? (
        <View className="rounded-card bg-card p-6 items-center justify-center">
          <GenieText variant="body-md" tone="secondary" className="text-center font-normal py-3">
            {t('lawyer:calendar.noAppointments')}
          </GenieText>
        </View>
      ) : (
        selectedAppointments.map(appt => {
          const isBusy = busyId === appt._id;
          const canConfirm = appt.status === 'pending';
          const canCancel =
            appt.status === 'pending' || appt.status === 'confirmed';

          return (
            <GenieCard key={appt._id} tone="surface" className="mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <GenieText variant="heading-sm" numberOfLines={1}>
                    {appt.client?.fullName ?? t('lawyer:calendar.client')}
                  </GenieText>
                  {appt.case?.title ? (
                    <GenieText
                      variant="body-sm"
                      tone="secondary"
                      className="mt-0.5"
                      numberOfLines={1}
                    >
                      {appt.case.title}
                    </GenieText>
                  ) : null}
                </View>
                <GenieStatusBadge status={appt.status} />
              </View>

              <View className="mt-2 flex-row items-center gap-2">
                <ClockIcon size={14} color={colors.textMuted} />
                <GenieText variant="body-sm" tone="secondary">
                  {appt.timeSlot} · {displayLabel('cases:mode', appt.mode)}
                </GenieText>
              </View>

              {appt.notes ? (
                <GenieText variant="caption" tone="muted" className="mt-2">
                  {appt.notes}
                </GenieText>
              ) : null}

              {canConfirm || canCancel ? (
                <View className="mt-3 flex-row gap-3">
                  {canCancel ? (
                    <Pressable
                      disabled={isBusy}
                      onPress={() => {
                        setActionError(null);
                        setBusyId(appt._id);
                        statusMutation.mutate({
                          id: appt._id,
                          status: 'cancelled',
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('lawyer:calendar.cancelA11y')}
                      className="min-h-touch flex-1 items-center justify-center rounded-control border border-error active:bg-error-surface"
                    >
                      <GenieText variant="label" tone="error">
                        {t('lawyer:calendar.cancel')}
                      </GenieText>
                    </Pressable>
                  ) : null}

                  {canConfirm ? (
                    <Pressable
                      disabled={isBusy}
                      onPress={() => {
                        setActionError(null);
                        setBusyId(appt._id);
                        statusMutation.mutate({
                          id: appt._id,
                          status: 'confirmed',
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('lawyer:calendar.confirmA11y')}
                      className="min-h-touch flex-1 items-center justify-center rounded-control bg-gold active:bg-gold-pressed"
                    >
                      <GenieText variant="label" tone="on-gold">
                        {t('lawyer:calendar.confirm')}
                      </GenieText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </GenieCard>
          );
        })
      )}

      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View className="flex-1 bg-overlay items-center justify-center px-4">
          <View className="w-full max-w-[400px] rounded-card bg-card p-6">
            <GenieText variant="heading-lg" className="font-bold text-white mb-4">
              {t('lawyer:calendar.addTitle')}
            </GenieText>

            {formError ? (
              <GenieNotice message={formError} tone="error" className="mb-3" />
            ) : null}

            <View className="mb-4">
              <GenieText variant="body-sm" tone="secondary" className="font-medium mb-1.5">
                {t('lawyer:calendar.selectClient')}
              </GenieText>

              <Pressable
                onPress={() => {
                  setIsClientPickerOpen(!isClientPickerOpen);
                  setIsTimePickerOpen(false);
                  setIsModePickerOpen(false);
                }}
                className="h-14 w-full flex-row items-center justify-between rounded-control border border-border bg-input px-4"
              >
                <GenieText variant="body-md" className="font-semibold text-white">
                  {selectedClient ? selectedClient.name : t('lawyer:calendar.selectClient')}
                </GenieText>
                <ChevronDownIcon size={18} color={colors.gold} />
              </Pressable>

              {isClientPickerOpen ? (
                <View className="mt-1.5 max-h-40 rounded-control border border-border bg-surface p-2">
                  <ScrollView nestedScrollEnabled className="max-h-36">
                    {clientList.length === 0 ? (
                      <View className="p-3">
                        <GenieText variant="body-sm" tone="muted">
                          {t('lawyer:calendar.noClients')}
                        </GenieText>
                      </View>
                    ) : (
                      clientList.map(item => (
                        <Pressable
                          key={item.clientId}
                          onPress={() => {
                            setSelectedClient(item);
                            setIsClientPickerOpen(false);
                          }}
                          className="p-3 rounded-lg active:bg-card flex-row items-center justify-between"
                        >
                          <GenieText variant="body-md" className="font-medium text-white">
                            {item.name}
                          </GenieText>
                          {item.issue ? (
                            <GenieText variant="caption" tone="muted" numberOfLines={1} className="max-w-[120px]">
                              {item.issue}
                            </GenieText>
                          ) : null}
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <View className="mb-4">
              <GenieText variant="body-sm" tone="secondary" className="font-medium mb-1.5">
                {t('lawyer:calendar.date')}
              </GenieText>

              <View className="h-14 w-full flex-row items-center justify-between rounded-control border border-border bg-input px-4">
                <GenieText variant="body-md" className="font-medium text-white">
                  {formatDate(selectedDateObj)}
                </GenieText>
                <CalendarIcon size={18} color={colors.gold} />
              </View>
            </View>

            <View className="mb-4">
              <GenieText variant="body-sm" tone="secondary" className="font-medium mb-1.5">
                {t('lawyer:calendar.timeSlot')}
              </GenieText>

              <Pressable
                onPress={() => {
                  setIsTimePickerOpen(!isTimePickerOpen);
                  setIsClientPickerOpen(false);
                  setIsModePickerOpen(false);
                }}
                className="h-14 w-full flex-row items-center justify-between rounded-control border border-border bg-input px-4"
              >
                <GenieText variant="body-md" className="font-medium text-white">
                  {selectedTimeSlot}
                </GenieText>
                <ChevronDownIcon size={18} color={colors.gold} />
              </Pressable>

              {isTimePickerOpen ? (
                <View className="mt-1.5 max-h-40 rounded-control border border-border bg-surface p-2">
                  <ScrollView nestedScrollEnabled className="max-h-36">
                    {TIME_SLOTS.map(slot => (
                      <Pressable
                        key={slot}
                        onPress={() => {
                          setSelectedTimeSlot(slot);
                          setIsTimePickerOpen(false);
                        }}
                        className="p-3 rounded-lg active:bg-card"
                      >
                        <GenieText variant="body-md" className="font-medium text-white">
                          {slot}
                        </GenieText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <View className="mb-5">
              <GenieText variant="body-sm" tone="secondary" className="font-medium mb-1.5">
                {t('lawyer:calendar.mode')}
              </GenieText>

              <Pressable
                onPress={() => {
                  setIsModePickerOpen(!isModePickerOpen);
                  setIsClientPickerOpen(false);
                  setIsTimePickerOpen(false);
                }}
                className="h-14 w-full flex-row items-center justify-between rounded-control border border-border bg-input px-4"
              >
                <GenieText variant="body-md" className="font-medium text-white">
                  {displayLabel('cases:mode', consultationMode)}
                </GenieText>
                <ChevronDownIcon size={18} color={colors.gold} />
              </Pressable>

              {isModePickerOpen ? (
                <View className="mt-1.5 rounded-control border border-border bg-surface p-2">
                  <Pressable
                    onPress={() => {
                      setConsultationMode('Chat');
                      setIsModePickerOpen(false);
                    }}
                    className="p-3 rounded-lg active:bg-card"
                  >
                    <GenieText variant="body-md" className="font-medium text-white">
                      {displayLabel('cases:mode', 'Chat')}
                    </GenieText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setConsultationMode('In-Person');
                      setIsModePickerOpen(false);
                    }}
                    className="p-3 rounded-lg active:bg-card"
                  >
                    <GenieText variant="body-md" className="font-medium text-white">
                      {displayLabel('cases:mode', 'In-Person')}
                    </GenieText>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={() => setIsAddModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:calendar.cancel')}
              className="py-2 self-end mb-3 active:opacity-70"
            >
              <GenieText variant="body-md" tone="secondary" className="font-semibold">
                {t('lawyer:calendar.cancel')}
              </GenieText>
            </Pressable>

            <Pressable
              onPress={handleAddAppointment}
              disabled={createAppointmentMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:calendar.add')}
              className="h-14 w-full items-center justify-center rounded-control bg-gold active:bg-gold-pressed"
            >
              {createAppointmentMutation.isPending ? (
                <ActivityIndicator color={colors.onGold} />
              ) : (
                <GenieText variant="body-lg" tone="on-gold" className="font-bold">
                  {t('lawyer:calendar.add')}
                </GenieText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </GenieScreen>
  );
};
