import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import {
  GenieButton,
  GenieModal,
  GenieNotice,
  GenieText,
} from '../../../components';
import type {
  HearingInput,
  HearingStatus,
  LawyerClientRow,
  LawyerHearing,
} from '../../../types/lawyer';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

const STATUSES: HearingStatus[] = ['scheduled', 'completed', 'adjourned', 'cancelled'];

const isValidDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) &&
  !Number.isNaN(Date.parse(value.trim()));

export interface HearingFormModalProps {
  visible: boolean;
  onClose: () => void;
  hearing?: LawyerHearing | null;
  cases: LawyerClientRow[];
  isSaving: boolean;
  error: string | null;
  onSubmit: (caseId: string, payload: HearingInput) => void;
}

const Field: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required = false, children }) => (
  <View className="mb-4">
    <GenieText variant="body-sm" className="mb-2 font-medium">
      {label}
      {required ? (
        <GenieText variant="body-sm" tone="error">
          {' *'}
        </GenieText>
      ) : null}
    </GenieText>
    {children}
  </View>
);

export const HearingFormModal: React.FC<HearingFormModalProps> = ({
  visible,
  onClose,
  hearing,
  cases,
  isSaving,
  error,
  onSubmit,
}) => {
  const { t } = useT();
  const isEditing = Boolean(hearing);

  const [caseId, setCaseId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [court, setCourt] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState<HearingStatus>('scheduled');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setTouched(false);
    setCaseId(hearing?.caseId ?? '');
    setDate(hearing?.date ? hearing.date.slice(0, 10) : '');
    setTimeSlot(hearing?.timeSlot ?? '');
    setCourt(hearing?.court ?? '');
    setPurpose(hearing?.purpose ?? '');
    setStatus((hearing?.status as HearingStatus) ?? 'scheduled');
    setNotes(hearing?.notes ?? '');
  }, [hearing, visible]);

  const dateError =
    touched && !date.trim()
      ? t('lawyer:hearings.form.dateRequired')
      : touched && !isValidDate(date)
      ? t('lawyer:hearings.form.dateFormat')
      : null;

  const caseError = touched && !caseId ? t('lawyer:hearings.form.chooseMatter') : null;

  const submit = () => {
    setTouched(true);

    if (!caseId || !isValidDate(date)) {
      return;
    }

    onSubmit(caseId, {
      date: date.trim(),
      timeSlot: timeSlot.trim(),
      court: court.trim(),
      purpose: purpose.trim(),
      status,
      notes: notes.trim(),
    });
  };

  return (
    <GenieModal
      visible={visible}
      onClose={onClose}
      title={isEditing ? t('lawyer:hearings.form.editTitle') : t('lawyer:hearings.form.addTitle')}
      dismissOnBackdropPress={!isSaving}
    >
      <ScrollView
        className="max-h-[420px]"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isEditing ? (
          <Field label={t('lawyer:hearings.form.matter')}>
            <View className="rounded-control border border-border bg-card px-4 py-3">
              <GenieText variant="body-md" numberOfLines={1}>
                {hearing?.caseTitle}
              </GenieText>
              <GenieText variant="caption" tone="muted" className="mt-0.5">
                {hearing?.clientName}
              </GenieText>
            </View>
          </Field>
        ) : (
          <Field label={t('lawyer:hearings.form.matter')} required>
            {cases.length === 0 ? (
              <GenieText variant="body-sm" tone="muted">
                {t('lawyer:hearings.form.noMatters')}
              </GenieText>
            ) : (
              <ScrollView
                className="max-h-40"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {cases.map(row => {
                  const active = caseId === row.caseId;
                  return (
                    <Pressable
                      key={row.caseId}
                      onPress={() => setCaseId(row.caseId)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`mb-2 min-h-touch justify-center rounded-control border px-4 py-3 active:opacity-80 ${
                        active
                          ? 'border-border bg-gold-muted'
                          : 'border-border bg-card'
                      }`}
                    >
                      <GenieText
                        variant="body-md"
                        tone={active ? 'gold' : 'primary'}
                        numberOfLines={1}
                      >
                        {row.issue}
                      </GenieText>
                      <GenieText variant="caption" tone="muted" className="mt-0.5">
                        {row.name}
                      </GenieText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {caseError ? (
              <GenieText variant="caption" tone="error" className="mt-1">
                {caseError}
              </GenieText>
            ) : null}
          </Field>
        )}

        <Field label={t('lawyer:hearings.form.date')} required>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder={t('lawyer:hearings.form.datePlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!isSaving}
            className={`min-h-control rounded-control border bg-card px-4 py-3 text-body-lg text-white ${
              dateError ? 'border-error' : 'border-border'
            }`}
            accessibilityLabel={t('lawyer:hearings.form.dateA11y')}
          />
          {dateError ? (
            <GenieText variant="caption" tone="error" className="mt-1">
              {dateError}
            </GenieText>
          ) : null}
        </Field>

        <Field label={t('lawyer:hearings.form.time')}>
          <TextInput
            value={timeSlot}
            onChangeText={setTimeSlot}
            placeholder={t('lawyer:hearings.form.timePlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!isSaving}
            className="min-h-control rounded-control border border-border bg-card px-4 py-3 text-body-lg text-white"
            accessibilityLabel={t('lawyer:hearings.form.timeA11y')}
          />
        </Field>

        <Field label={t('lawyer:hearings.form.court')}>
          <TextInput
            value={court}
            onChangeText={setCourt}
            placeholder={t('lawyer:hearings.form.courtPlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!isSaving}
            className="min-h-control rounded-control border border-border bg-card px-4 py-3 text-body-lg text-white"
            accessibilityLabel={t('lawyer:hearings.form.court')}
          />
        </Field>

        <Field label={t('lawyer:hearings.form.purpose')}>
          <TextInput
            value={purpose}
            onChangeText={setPurpose}
            placeholder={t('lawyer:hearings.form.purposePlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!isSaving}
            className="min-h-control rounded-control border border-border bg-card px-4 py-3 text-body-lg text-white"
            accessibilityLabel={t('lawyer:hearings.form.purposeA11y')}
          />
        </Field>

        <Field label={t('lawyer:hearings.form.status')}>
          <View className="flex-row flex-wrap gap-2">
            {STATUSES.map(option => {
              const active = status === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setStatus(option)}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`min-h-touch justify-center rounded-pill px-4 ${
                    active
                      ? 'bg-gold'
                      : 'border border-border bg-surface active:bg-surface-secondary'
                  }`}
                >
                  <GenieText
                    variant="body-sm"
                    tone={active ? 'on-gold' : 'secondary'}
                    className={active ? 'font-semibold' : ''}
                  >
                    {displayLabel('cases:status', option)}
                  </GenieText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label={t('lawyer:hearings.form.notes')}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('lawyer:hearings.form.notesPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            editable={!isSaving}
            className="min-h-[90px] rounded-control border border-border bg-card px-4 py-3 text-body-lg text-white"
            accessibilityLabel={t('lawyer:hearings.form.notesA11y')}
          />
          <GenieText variant="caption" tone="muted" className="mt-1">
            {t('lawyer:hearings.form.notesHint')}
          </GenieText>
        </Field>

        {error ? <GenieNotice tone="error" message={error} /> : null}
      </ScrollView>

      <View className="mt-4 flex-row gap-3">
        <GenieButton
          label={t('lawyer:hearings.form.cancel')}
          variant="outline"
          onPress={onClose}
          disabled={isSaving}
          className="flex-1"
        />
        <GenieButton
          label={isEditing ? t('lawyer:hearings.form.save') : t('lawyer:hearings.form.add')}
          loading={isSaving}
          onPress={submit}
          className="flex-1"
        />
      </View>
    </GenieModal>
  );
};
