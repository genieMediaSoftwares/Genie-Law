import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  GenieBottomSheet,
  GenieButton,
  GenieNotice,
  GenieText,
} from '../ui';
import { colors } from '../../theme';
import type { Appointment } from '../../types/lawyer';
import { formatDateParts } from '../../utils/format';
import { useT } from '../../i18n/useT';

const DAYS_AHEAD = 14;
const MAX_NOTES = 500;

// The backend's Appointment.mode enum — the only two modes it accepts.
const MODES = [
  { value: 'Chat', labelKey: 'client:booking.chat' },
  { value: 'In-Person', labelKey: 'client:booking.inPerson' },
] as const satisfies ReadonlyArray<{ value: Appointment['mode']; labelKey: string }>;

const SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const nextDays = (count: number): Date[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() + index);
    return day;
  });
};

export interface BookConsultationSheetProps {
  visible: boolean;
  lawyerName: string;
  consultationFee?: number | null;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    date: string;
    timeSlot: string;
    mode: Appointment['mode'];
    notes?: string;
  }) => void;
}

export const BookConsultationSheet: React.FC<BookConsultationSheetProps> = ({
  visible,
  lawyerName,
  consultationFee,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) => {
  const { t } = useT();
  const days = useMemo(() => nextDays(DAYS_AHEAD), []);
  const [selectedDay, setSelectedDay] = useState<Date>(days[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState<Appointment['mode']>('Chat');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedDay(days[0]);
      setSlot(null);
      setMode('Chat');
      setNotes('');
    }
  }, [visible, days]);

  const canSubmit = Boolean(slot) && !isSubmitting;

  return (
    <GenieBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('client:booking.title')}
      footer={
        <GenieButton
          label={t('client:booking.confirm')}
          loadingLabel={t('client:booking.booking')}
          loading={isSubmitting}
          disabled={!canSubmit}
          onPress={() =>
            slot &&
            onSubmit({
              date: selectedDay.toISOString(),
              timeSlot: slot,
              mode,
              notes: notes.trim() || undefined,
            })
          }
        />
      }
    >
      <View className="px-4 pb-2">
        <GenieText variant="body-sm" tone="secondary">
          {typeof consultationFee === 'number' && consultationFee > 0
            ? t('client:booking.feeNote', { name: lawyerName, fee: consultationFee })
            : t('client:booking.notifyNote', { name: lawyerName })}
        </GenieText>

        <GenieText variant="label" className="mb-2 mt-4">
          {t('client:booking.date')}
        </GenieText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {days.map(day => {
              const active = day.getTime() === selectedDay.getTime();
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => setSelectedDay(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={formatDateParts(day, { weekday: 'long', day: 'numeric', month: 'long' })}
                  className={`h-[62px] w-[52px] items-center justify-center rounded-control border ${
                    active ? 'border-gold bg-gold' : 'border-border bg-surface'
                  }`}
                >
                  <GenieText variant="caption" tone={active ? 'on-gold' : 'muted'}>
                    {formatDateParts(day, { weekday: 'short' })}
                  </GenieText>
                  <GenieText
                    variant="body"
                    tone={active ? 'on-gold' : 'primary'}
                    className="font-bold"
                  >
                    {String(day.getDate())}
                  </GenieText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <GenieText variant="label" className="mb-2 mt-4">
          {t('client:booking.time')}
        </GenieText>
        <View className="flex-row flex-wrap gap-2">
          {SLOTS.map(option => {
            const active = option === slot;
            return (
              <Pressable
                key={option}
                onPress={() => setSlot(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('client:booking.timeA11y', { time: option })}
                className={`min-h-touch justify-center rounded-pill border px-4 ${
                  active ? 'border-gold bg-gold' : 'border-border bg-surface'
                }`}
              >
                <GenieText
                  variant="body-sm"
                  tone={active ? 'on-gold' : 'secondary'}
                  className="font-semibold"
                >
                  {option}
                </GenieText>
              </Pressable>
            );
          })}
        </View>

        <GenieText variant="label" className="mb-2 mt-4">
          {t('client:booking.mode')}
        </GenieText>
        <View className="flex-row gap-2">
          {MODES.map(option => {
            const active = option.value === mode;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMode(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(option.labelKey)}
                className={`min-h-touch flex-1 items-center justify-center rounded-control border ${
                  active ? 'border-gold bg-gold' : 'border-border bg-surface'
                }`}
              >
                <GenieText
                  variant="body-sm"
                  tone={active ? 'on-gold' : 'secondary'}
                  className="font-semibold"
                >
                  {t(option.labelKey)}
                </GenieText>
              </Pressable>
            );
          })}
        </View>

        <GenieText variant="label" className="mb-2 mt-4">
          {t('client:booking.notesLabel')}
        </GenieText>
        <TextInput
          value={notes}
          onChangeText={text => setNotes(text.slice(0, MAX_NOTES))}
          placeholder={t('client:booking.notesPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('client:booking.notesA11y')}
          className="min-h-[90px] rounded-control border border-border bg-card px-4 py-3 text-body-md text-white"
        />

        {error ? <GenieNotice tone="error" message={error} className="mt-3" /> : null}
      </View>
    </GenieBottomSheet>
  );
};
