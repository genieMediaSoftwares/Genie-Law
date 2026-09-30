import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { caseDraftFiles } from '../../../services/caseDraftFiles';
import {
  noRelevantDocumentMessage,
  relevanceLabel,
  verifyDocuments,
  type FailedDocument,
  type RejectedDocument,
} from '../../../services/documentRelevance';
import { DocumentRelevanceAlert } from '../../../components/documents/DocumentRelevanceAlert';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GenieButton,
  GenieHeader,
  GenieMicButton,
  GenieNotice,
  GenieText,
  GenieAiDisclaimer,
} from '../../../components';
import { CheckIcon } from '../../../components/icons/Icons';
import {
  ChevronRightIcon,
  CloudUploadIcon,
  FileIcon,
  GlobeIcon,
  SparkleIcon,
  TrashIcon,
} from '../../../components/icons/ClientIcons';
import {
  UPLOAD_LIMITS,
  aiApi,
  MAX_DOCUMENT_SIZE,
  oversizedDocumentReason,
} from '../../../api/aiApi';
import {
  describeOptimization,
  prepareAiFiles,
  progressLabel,
} from '../../../services/aiFileOptimizer';
import type { PrepareProgress } from '../../../services/aiFileOptimizer';
import { filePicker } from '../../../services/filePicker';
import { rejectOversizedDocuments } from '../../../services/documentSizeGuard';
import { voiceRecorder } from '../../../services/voiceRecorder';
import { toAppError } from '../../../utils/errors';
import { formatFileSize } from '../../../utils/format';
import type { PickedFile } from '../../../types/ai';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { startTrace } from '../../../utils/perfTrace';
import { useT } from '../../../i18n/useT';
import i18n from '../../../i18n';

const MAX_NOTES = 5000;

const LANGUAGES = [
  { code: '', label: '' }, // "Auto": translated where shown
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

const makeRequestId = (): string => {
  let random = '';
  for (let i = 0; i < 12; i += 1) {
    random += Math.floor(Math.random() * 36).toString(36);
  }
  return `ai-${Date.now().toString(36)}-${random}`;
};

const formatDuration = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const SectionTitle: React.FC<{
  title: string;
  subtitle?: string;
  required?: boolean;
}> = ({ title, subtitle, required = false }) => (
  <View className="mb-3 mt-6">
    <GenieText variant="heading-md">
      {title}
      {required ? (
        <GenieText variant="heading-md" tone="error">
          {' *'}
        </GenieText>
      ) : null}
    </GenieText>
    {subtitle ? (
      <GenieText variant="body-sm" tone="secondary" className="mt-1">
        {subtitle}
      </GenieText>
    ) : null}
  </View>
);

export const AiAssistantScreen: React.FC<
  ClientStackScreenProps<'AiAssistant'>
> = ({ navigation }) => {
  const { t } = useT();
  const languageName = (code: string, label: string) =>
    code ? label : t('assistant:auto');
  // Only documents the AI accepted as relevant to the case.
  const [documents, setDocuments] = useState<PickedFile[]>([]);
  // Being checked for relevance right now.
  const [checking, setChecking] = useState<PickedFile[]>([]);
  // Checks that could not complete; the user can retry or remove them.
  const [failed, setFailed] = useState<FailedDocument[]>([]);
  // Rejected by the last check; shown in the "Document Not Relevant" alert.
  const [rejected, setRejected] = useState<RejectedDocument[]>([]);
  const [notes, setNotes] = useState('');

  const [voice, setVoice] = useState<PickedFile | null>(null);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState('');

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
  const [recordedMs, setRecordedMs] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preparing, setPreparing] = useState<PrepareProgress | null>(null);
  // Guards against a second pick starting while the first is still optimizing.
  const preparingRef = useRef(false);
  const [uploadFraction, setUploadFraction] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(makeRequestId());
  // Set synchronously on tap, so a double tap before the next render still
  // sends one request (isSubmitting only changes after a re-render).
  const submittingRef = useRef(false);
  // Leaving the screen mid-upload must not navigate from wherever the user is.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const remainingSlots =
    UPLOAD_LIMITS.maxDocuments - documents.length - checking.length - failed.length;

  // Checks files against what the client has told us so far, then keeps only
  // the accepted ones. Rejected files are dropped and explained in the alert.
  const checkRelevance = useCallback(
    async (files: PickedFile[]) => {
      setChecking(files);
      try {
        const outcome = await verifyDocuments(files, {
          notes,
          voiceTranscript: transcript,
          acceptedDocumentTypes: documents
            .map(file => file.relevance?.documentType ?? '')
            .filter(Boolean),
        });
        setDocuments(current =>
          [...current, ...outcome.accepted].slice(0, UPLOAD_LIMITS.maxDocuments),
        );
        setFailed(current => [...current, ...outcome.failed]);
        setRejected(outcome.rejected);
        if (
          documents.length === 0 &&
          outcome.accepted.length === 0 &&
          outcome.rejected.length > 0
        ) {
          setError(noRelevantDocumentMessage());
        }
      } finally {
        setChecking([]);
      }
    },
    [documents, notes, transcript],
  );

  const retryFailed = useCallback(
    async (index: number) => {
      if (preparingRef.current) {
        return;
      }
      const entry = failed[index];
      if (!entry) {
        return;
      }
      setError(null);
      setFailed(current => current.filter((_, i) => i !== index));
      preparingRef.current = true;
      try {
        await checkRelevance([entry.file]);
      } finally {
        preparingRef.current = false;
      }
    },
    [checkRelevance, failed],
  );

  const removeFailed = useCallback((index: number) => {
    setFailed(current => current.filter((_, i) => i !== index));
  }, []);

  const addDocuments = useCallback(async () => {
    if (preparingRef.current) {
      return;
    }
    setError(null);

    try {
      const { accepted: picked } = await rejectOversizedDocuments(
        await filePicker.pickDocuments(remainingSlots),
      );
      if (picked.length === 0) {
        return;
      }

      preparingRef.current = true;
      let prepared;
      try {
        prepared = await prepareAiFiles(picked, setPreparing);
      } finally {
        preparingRef.current = false;
        setPreparing(null);
      }

      if (prepared.rejections.length > 0) {
        setError(prepared.rejections.join('\n'));
      }

      // Only prepared copies are checked; an oversized original never is.
      // New picks stay blocked until the check finishes.
      const ready = prepared.ready;
      if (ready.length > 0) {
        preparingRef.current = true;
        try {
          await checkRelevance(ready);
        } finally {
          preparingRef.current = false;
        }
      }
    } catch (pickError) {
      setError(toAppError(pickError).message);
    }
  }, [checkRelevance, remainingSlots]);

  const removeDocument = useCallback((index: number) => {
    setDocuments(current => current.filter((_, i) => i !== index));
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const granted = await voiceRecorder.requestPermission();
      if (!granted) {
        setError(
          i18n.t('assistant:micDenied'),
        );
        return;
      }

      setRecordedMs(0);
      setIsRecording(true);
      await voiceRecorder.start(state => setRecordedMs(state.durationMs));
    } catch (recordError) {
      setIsRecording(false);
      setError(toAppError(recordError).message);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);

    const trace = startTrace('voice-note');
    let file: PickedFile;
    try {
      file = await voiceRecorder.stop();
      trace.mark('recorder-stopped');
    } catch (stopError) {
      trace.end('error');
      setError(toAppError(stopError).message);
      return;
    }

    setVoice(file);
    setIsTranscribing(true);

    try {
      const result = await aiApi.transcribe(file, language || undefined);
      trace.mark('transcribed');
      trace.end();
      const text = (result.transcript || '').trim();

      if (!text) {
        setError(
          i18n.t('assistant:nothingHeard'),
        );
      } else {
        setTranscript(text);
        setDetectedLanguage(result.language || '');
      }
    } catch (transcribeError) {
      trace.end('error');
      setError(
        i18n.t('assistant:recordingKept', { message: toAppError(transcribeError).message }),
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [language]);

  const discardVoice = useCallback(async () => {
    await voiceRecorder.cancel();
    setVoice(null);
    setTranscript('');
    setDetectedLanguage('');
    setRecordedMs(0);
    setIsRecording(false);
  }, []);

  const submit = useCallback(async () => {
    if (submittingRef.current || preparingRef.current) {
      return;
    }

    if (documents.length === 0) {
      setError(
        i18n.t('assistant:attachOne'),
      );
      return;
    }

    const tooLarge = oversizedDocumentReason(documents);
    if (tooLarge) {
      setError(tooLarge);
      return;
    }

    submittingRef.current = true;
    setError(null);
    setIsSubmitting(true);
    setUploadFraction(0);

    const trace = startTrace('ai-analyze-upload');
    try {
      const accepted = await aiApi.analyze({
        documents,
        voice,
        issueDescription: notes,
        voiceTranscript: transcript,
        voiceLanguage: language || detectedLanguage || undefined,
        requestId: requestId.current,
        onUploadProgress: setUploadFraction,
      });

      if (!accepted?.sessionId) {
        // Never continue without the session the server says it started.
        throw new Error(i18n.t('common:errors.generic'));
      }
      trace.mark('uploaded+accepted');
      trace.end();
      if (!mountedRef.current) {
        return;
      }
      // The server only read the documents; they are submitted with the case.
      caseDraftFiles.stash(accepted.sessionId, documents);
      navigation.replace('PostCase', { sessionId: accepted.sessionId });
    } catch (submitError) {
      trace.end('error');
      const info = toAppError(submitError);
      // The same requestId lets the backend replay an analysis that did start
      // when only the response was lost (network/timeout). After a definite
      // refusal nothing started, so the next attempt is a new request.
      if (!info.isNetworkError) {
        requestId.current = makeRequestId();
      }
      if (mountedRef.current) {
        setError(info.message);
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [
    detectedLanguage,
    documents,
    language,
    navigation,
    notes,
    transcript,
    voice,
  ]);

  const isChecking = checking.length > 0;
  const uploadDisabled =
    isSubmitting || preparing !== null || isChecking || remainingSlots <= 0;


  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('assistant:title')}
        onBack={() => navigation.goBack()}
      />

      <GenieAiDisclaimer className="px-4 pb-1 pt-1" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mt-3 flex-row items-center gap-4 rounded-card bg-card p-4">
            <SparkleIcon size={30} color={colors.gold} />
            <View className="flex-1">
              <GenieText variant="heading-md">{t('assistant:intakeTitle')}</GenieText>
              <GenieText variant="body-sm" tone="secondary" className="mt-1">
                {t('assistant:intakeDescription')}
              </GenieText>
            </View>
          </View>

          {error ? (
            <GenieNotice tone="error" message={error} className="mt-4" />
          ) : null}

          <SectionTitle
            title={t('assistant:uploadTitle')}
            required
            subtitle={t('assistant:uploadSubtitle', {
              max: UPLOAD_LIMITS.maxDocuments,
              size: formatFileSize(MAX_DOCUMENT_SIZE),
            })}
          />

          {documents.map((file, index) => (
            <View
              key={`${file.name}-${index}`}
              className="mb-2 flex-row items-center rounded-card bg-card p-3"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gold-muted">
                <FileIcon size={18} color={colors.gold} />
              </View>

              <View className="flex-1">
                <GenieText variant="body-md" numberOfLines={1}>
                  {file.name}
                </GenieText>
                <View className="mt-0.5 flex-row items-center gap-1">
                  <CheckIcon size={13} color={colors.success} />
                  <GenieText
                    variant="caption"
                    tone="success"
                    className="flex-1"
                    numberOfLines={1}
                    testID={`ai-document-status-${index}`}
                  >
                    {relevanceLabel(file) ?? t('documents:relevance.verified')}
                  </GenieText>
                </View>
                <GenieText variant="caption" tone="muted" className="mt-0.5">
                  {describeOptimization(file) ??
                    [
                      file.size !== null ? formatFileSize(file.size) : '',
                      t('assistant:readyToSubmit'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                </GenieText>
              </View>

              {!isSubmitting ? (
                <Pressable
                  onPress={() => removeDocument(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('assistant:removeA11y', { name: file.name })}
                  className="min-h-touch min-w-touch items-center justify-center active:opacity-70"
                >
                  <TrashIcon size={18} color={colors.error} />
                </Pressable>
              ) : null}
            </View>
          ))}

          {checking.map((file, index) => (
            <View
              key={`checking-${file.name}-${index}`}
              testID="ai-document-checking"
              accessibilityLiveRegion="polite"
              className="mb-2 flex-row items-center rounded-card bg-card p-3"
            >
              <ActivityIndicator size="small" color={colors.gold} />
              <View className="ml-3 flex-1">
                <GenieText variant="body-md" numberOfLines={1}>
                  {file.name}
                </GenieText>
                <GenieText variant="caption" tone="gold" className="mt-0.5">
                  {t('assistant:analyzing')}
                </GenieText>
              </View>
            </View>
          ))}

          {failed.map((entry, index) => (
            <View
              key={`failed-${entry.file.name}-${index}`}
              testID="ai-document-failed"
              className="mb-2 flex-row items-center rounded-card border border-error bg-card p-3"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-error-surface">
                <FileIcon size={18} color={colors.error} />
              </View>
              <Pressable
                onPress={() => {
                  void retryFailed(index);
                }}
                disabled={isChecking || isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={t('assistant:verifyAgainA11y', { name: entry.file.name })}
                className="flex-1 active:opacity-70"
              >
                <GenieText variant="body-md" numberOfLines={1}>
                  {entry.file.name}
                </GenieText>
                <GenieText variant="caption" tone="error" className="mt-0.5">
                  {t('assistant:tapToRetry', { message: entry.message })}
                </GenieText>
              </Pressable>
              <Pressable
                onPress={() => removeFailed(index)}
                accessibilityRole="button"
                accessibilityLabel={t('assistant:removeA11y', { name: entry.file.name })}
                className="min-h-touch min-w-touch items-center justify-center active:opacity-70"
              >
                <TrashIcon size={18} color={colors.error} />
              </Pressable>
            </View>
          ))}

          {preparing ? (
            <View
              testID="ai-document-preparing"
              accessibilityLiveRegion="polite"
              className="mb-2 flex-row items-center rounded-card bg-card p-3"
            >
              <ActivityIndicator size="small" color={colors.gold} />
              <View className="ml-3 flex-1">
                <GenieText variant="body-md" numberOfLines={1}>
                  {preparing.file.name}
                </GenieText>
                <GenieText variant="caption" tone="gold" className="mt-0.5">
                  {progressLabel(preparing)}
                </GenieText>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={addDocuments}
            disabled={uploadDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('assistant:browseA11y')}
            accessibilityState={{ disabled: uploadDisabled }}
            className={`items-center rounded-card border border-dashed bg-card px-4 py-8 ${
              uploadDisabled ? 'opacity-50' : 'active:opacity-80'
            }`}
          >
            <CloudUploadIcon size={42} color={colors.gold} />
            <GenieText variant="body-lg" className="mt-3 font-bold">
              {remainingSlots <= 0
                ? t('assistant:maxAttached', { count: UPLOAD_LIMITS.maxDocuments })
                : documents.length === 0
                ? t('assistant:browse')
                : t('assistant:addAnother')}
            </GenieText>
            <GenieText variant="body-sm" tone="muted" className="mt-1 text-center">
              {t('assistant:selectHint')}
            </GenieText>
          </Pressable>

          <SectionTitle
            title={t('assistant:voiceTitle')}
            subtitle={t('assistant:voiceSubtitle')}
          />

          {!voiceRecorder.isSupported ? (
            <GenieText variant="body-sm" tone="muted">
              {t('assistant:voiceUnsupported')}
            </GenieText>
          ) : (
            <View className="rounded-card bg-card p-4">
              <View className="flex-row items-center gap-2">
                <GlobeIcon size={20} color={colors.textSecondary} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="gap-2"
                >
                  {LANGUAGES.map(option => {
                    const active = language === option.code;
                    return (
                      <Pressable
                        key={option.code || 'auto'}
                        onPress={() => setLanguage(option.code)}
                        disabled={isRecording || isTranscribing}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={t('assistant:transcribeIn', {
                          language: languageName(option.code, option.label),
                        })}
                        className={`min-h-touch justify-center rounded-pill px-4 ${
                          active
                            ? 'bg-gold'
                            : 'bg-surface active:bg-surface-secondary'
                        }`}
                      >
                        <GenieText
                          variant="body-md"
                          tone={active ? 'on-gold' : 'secondary'}
                          className={active ? 'font-semibold' : ''}
                        >
                          {languageName(option.code, option.label)}
                        </GenieText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="mt-4 flex-row items-center gap-3">
                <GenieMicButton
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={isSubmitting || isTranscribing}
                  isRecording={isRecording}
                  isBusy={isTranscribing}
                  accessibilityLabel={
                    isRecording ? t('assistant:stopRecording') : t('assistant:tapMic')
                  }
                />

                <View className="flex-1">
                  <GenieText variant="heading-sm">
                    {isRecording
                      ? t('assistant:recording', { time: formatDuration(recordedMs) })
                      : isTranscribing
                      ? t('assistant:transcribing')
                      : voice
                      ? t('assistant:voiceRecorded')
                      : t('assistant:tapMic')}
                  </GenieText>
                  <GenieText variant="body-sm" tone="muted" className="mt-0.5">
                    {isRecording
                      ? t('assistant:tapToStop')
                      : isTranscribing
                      ? t('assistant:readingRecording')
                      : voice
                      ? t('assistant:reviewTranscript')
                      : t('assistant:transcribedOnStop')}
                  </GenieText>
                </View>

                {voice && !isRecording && !isTranscribing ? (
                  <Pressable
                    onPress={discardVoice}
                    accessibilityRole="button"
                    accessibilityLabel={t('assistant:discardVoice')}
                    className="min-h-touch min-w-touch items-center justify-center active:opacity-70"
                  >
                    <TrashIcon size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>

              {transcript || (voice && !isTranscribing) ? (
                <View className="mt-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <GenieText variant="body-sm" tone="gold" className="font-semibold">
                      {t('assistant:transcript')}
                    </GenieText>
                    {detectedLanguage ? (
                      <GenieText variant="caption" tone="muted">
                        {t('assistant:detected', {
                          language:
                            LANGUAGES.find(l => l.code === detectedLanguage)?.label ??
                            detectedLanguage,
                        })}
                      </GenieText>
                    ) : null}
                  </View>

                  <TextInput
                    value={transcript}
                    onChangeText={setTranscript}
                    placeholder={t('assistant:transcriptPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    editable={!isSubmitting}
                    className="min-h-[90px] rounded-control bg-surface px-4 py-3 text-body-lg text-white"
                    accessibilityLabel={t('assistant:transcriptA11y')}
                  />
                </View>
              ) : null}
            </View>
          )}

          <SectionTitle title={t('assistant:notesTitle')} />

          <View className="rounded-card bg-card p-3">
            <TextInput
              className="min-h-[110px] text-body-lg text-white"
              value={notes}
              onChangeText={text => setNotes(text.slice(0, MAX_NOTES))}
              placeholder={t('assistant:notesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={MAX_NOTES}
              editable={!isSubmitting}
              accessibilityLabel={t('assistant:notesA11y')}
            />
            <GenieText variant="caption" tone="muted" className="mt-1 self-end">
              {`${notes.length} / ${MAX_NOTES}`}
            </GenieText>
          </View>

          {isSubmitting ? (
            <View className="mt-4">
              <View className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-alt">
                <View
                  className="h-full rounded-pill bg-gold"
                  style={{ width: `${Math.round(uploadFraction * 100)}%` }}
                />
              </View>
              <GenieText variant="caption" tone="muted" className="mt-1">
                {t('assistant:uploadingPercent', { percent: Math.round(uploadFraction * 100) })}
              </GenieText>
            </View>
          ) : null}

          <View className="mt-6">
            <GenieButton
              label={t('assistant:analyse')}
              loadingLabel={t('assistant:uploading')}
              loading={isSubmitting}
              disabled={documents.length === 0 || preparing !== null || isChecking}
              onPress={submit}
              icon={
                <ChevronRightIcon
                  size={18}
                  color={
                    documents.length === 0 ? colors.textMuted : colors.onGold
                  }
                />
              }
              iconPosition="right"
            />
            <GenieText variant="caption" tone="muted" className="mt-2 text-center">
              {isChecking
                ? t('assistant:waitChecking')
                : documents.length === 0
                ? t('assistant:addOneToContinue')
                : t('assistant:filledAutomatically')}
            </GenieText>
          </View>
        </ScrollView>

        <DocumentRelevanceAlert
          rejected={rejected}
          onClose={() => setRejected([])}
          onChooseAnother={() => {
            setRejected([]);
            void addDocuments();
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
