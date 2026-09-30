import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { GenieMicButton, GenieNotice, GenieText } from '../../../../components';
import {
  CourtIcon,
  LocationIcon,
  SparkleIcon,
} from '../../../../components/icons/ClientIcons';
import { aiApi } from '../../../../api/aiApi';
import { voiceRecorder } from '../../../../services/voiceRecorder';
import { toAppError } from '../../../../utils/errors';
import { AiBadge } from '../AiBadge';
import { shortenDescription, type PostCaseState } from '../types';
import { colors } from '../../../../theme';
import { startTrace } from '../../../../utils/perfTrace';
import { useT } from '../../../../i18n/useT';
import { subTypeLabel } from '../../../../i18n/labels';

const MAX_DESCRIPTION = 5000;

interface DetailsStepProps {
  state: PostCaseState;
  onChange: (patch: Partial<PostCaseState>) => void;
  onFieldEdited: (field: string) => void;
}

const Label: React.FC<{
  text: string;
  required?: boolean;
  aiFilled?: boolean;
}> = ({ text, required = false, aiFilled = false }) => (
  <View className="mb-2 flex-row items-center gap-2">
    <GenieText variant="body-md" className="font-medium">
      {text}
      {required ? (
        <GenieText variant="body-md" tone="error">
          {' *'}
        </GenieText>
      ) : null}
    </GenieText>
    {aiFilled ? <AiBadge /> : null}
  </View>
);

export const DetailsStep: React.FC<DetailsStepProps> = ({
  state,
  onChange,
  onFieldEdited,
}) => {
  const { t } = useT();
  const [isRecording, setIsRecording] = useState(false);

  // Leaving the screen mid-recording must not leave the microphone on.
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  useEffect(
    () => () => {
      if (isRecordingRef.current) {
        voiceRecorder.cancel().catch(() => undefined);
      }
    },
    [],
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const aiFields = new Set(state.aiFields);

  const edit = useCallback(
    (field: keyof PostCaseState, value: string) => {
      onChange({ [field]: value } as Partial<PostCaseState>);
      onFieldEdited(field);
    },
    [onChange, onFieldEdited],
  );

  const toggleDictation = useCallback(async () => {
    setVoiceError(null);

    if (isTranscribing) {
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);
      const trace = startTrace('voice-dictation');
      try {
        const audio = await voiceRecorder.stop();
        trace.mark('recorder-stopped');
        const result = await aiApi.transcribe(audio);
        trace.mark('transcribed');
        trace.end();
        const text = (result.transcript || '').trim();

        if (!text) {
          setVoiceError(t('client:postCase.details.nothingHeard'));
          return;
        }

        const existing = state.description.trim();
        const combined = existing ? `${existing} ${text}` : text;
        edit('description', combined.slice(0, MAX_DESCRIPTION));
      } catch (error) {
        trace.end('error');
        setVoiceError(toAppError(error).message);
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    try {
      const granted = await voiceRecorder.requestPermission();
      if (!granted) {
        setVoiceError(t('client:postCase.details.micNeeded'));
        return;
      }
      await voiceRecorder.start(() => {});
      setIsRecording(true);
    } catch (error) {
      setVoiceError(toAppError(error).message);
    }
  }, [edit, isRecording, isTranscribing, state.description, t]);

  const titlePlaceholder = state.subcategory
    ? t('client:postCase.details.titleBlank', { subType: subTypeLabel(state.subcategory) })
    : t('client:postCase.details.titleShort');

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-6 pt-5"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <GenieText variant="heading-lg" className="mb-4">
        {t('client:postCase.details.heading')}
      </GenieText>

      <Label text={t('client:postCase.details.caseTitle')} aiFilled={aiFields.has('title')} />
      <TextInput
        value={state.title}
        onChangeText={value => edit('title', value)}
        placeholder={titlePlaceholder}
        placeholderTextColor={colors.textMuted}
        className="min-h-control rounded-control bg-surface px-4 py-3 text-body-lg text-white"
        returnKeyType="next"
        maxLength={200}
      />

      <View className="mt-5">
        <Label
          text={t('client:postCase.details.description')}
          required
          aiFilled={aiFields.has('description')}
        />

        <View className="rounded-control bg-surface">
          <TextInput
            value={state.description}
            onChangeText={value => edit('description', value)}
            placeholder={t('client:postCase.details.descriptionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={MAX_DESCRIPTION}
            className="min-h-[160px] px-4 py-3 pb-14 text-body-lg text-white"
          />

          <GenieMicButton
            onPress={toggleDictation}
            accessibilityLabel={
              isRecording ? t('client:postCase.details.stopDictation') : t('client:postCase.details.dictate')
            }
            isRecording={isRecording}
            isBusy={isTranscribing}
            disabled={isTranscribing || !voiceRecorder.isSupported}
            className="absolute bottom-3 right-3"
          />
        </View>

        <View className="mt-1.5 flex-row items-center justify-between">
          <GenieText variant="caption" tone="muted">
            {isRecording
              ? t('client:postCase.details.listening')
              : isTranscribing
              ? t('client:postCase.details.transcribing')
              : ''}
          </GenieText>
          <GenieText variant="caption" tone="muted">
            {`${state.description.length}/${MAX_DESCRIPTION}`}
          </GenieText>
        </View>

        {state.aiFullDescription ? (
          <Pressable
            onPress={() => {
              const isShowingFull =
                state.description.trim() === state.aiFullDescription.trim();

              onChange({
                description: isShowingFull
                  ? shortenDescription(state.aiFullDescription)
                  : state.aiFullDescription,
              });
            }}
            accessibilityRole="button"
            className="mt-2 min-h-touch flex-row items-center gap-1.5 active:opacity-70"
          >
            <SparkleIcon size={14} color={colors.gold} />
            <GenieText variant="body-sm" tone="gold">
              {state.description.trim() === state.aiFullDescription.trim()
                ? t('client:postCase.details.shortenAgain')
                : t('client:postCase.details.showFull')}
            </GenieText>
          </Pressable>
        ) : null}

        {voiceError ? (
          <GenieNotice tone="error" message={voiceError} className="mt-2" />
        ) : null}
      </View>

      <View className="mt-5">
        <Label
          text={t('client:postCase.details.location')}
          required
          aiFilled={aiFields.has('location')}
        />
        <View className="min-h-control flex-row items-center rounded-control bg-surface px-4">
          <LocationIcon size={20} color={colors.gold} />
          <TextInput
            value={state.location}
            onChangeText={value => edit('location', value)}
            placeholder={t('client:postCase.details.locationPlaceholder')}
            placeholderTextColor={colors.textMuted}
            className="ml-3 flex-1 py-3 text-body-lg text-white"
            maxLength={120}
          />
        </View>
      </View>

      <View className="mt-5">
        <Label
          text={t('client:postCase.details.court')}
          aiFilled={aiFields.has('preferredCourt')}
        />
        <View className="min-h-control flex-row items-center rounded-control bg-surface px-4">
          <CourtIcon size={20} color={colors.gold} />
          <TextInput
            value={state.preferredCourt}
            onChangeText={value => edit('preferredCourt', value)}
            placeholder={t('client:postCase.details.courtPlaceholder')}
            placeholderTextColor={colors.textMuted}
            className="ml-3 flex-1 py-3 text-body-lg text-white"
            maxLength={120}
          />
        </View>
      </View>

      {state.aiWarnings.length > 0 ? (
        <GenieNotice
          tone="warning"
          className="mt-5"
          message={state.aiWarnings.join('\n')}
        />
      ) : null}
    </ScrollView>
  );
};
