import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieButton,
  GenieNotice,
  GenieText,
} from '../../../../components';
import {
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  RefreshIcon,
  SparkleIcon,
  TrashIcon,
  UploadArrowIcon,
} from '../../../../components/icons/ClientIcons';
import {
  UPLOAD_LIMITS,
  aiApi,
  MAX_DOCUMENT_SIZE,
  rejectionReasonFor,
} from '../../../../api/aiApi';
import { prepareAiFiles, progressLabel } from '../../../../services/aiFileOptimizer';
import { filePicker } from '../../../../services/filePicker';
import { rejectOversizedDocuments } from '../../../../services/documentSizeGuard';
import { toAppError } from '../../../../utils/errors';
import { formatFileSize } from '../../../../utils/format';
import { AiProcessingPanel } from '../AiProcessingPanel';
import type { PickedFile } from '../../../../types/ai';
import { relevanceContextOf, toPendingDocument } from '../types';
import {
  noRelevantDocumentMessage,
  verificationFailedMessage,
  relevanceLabel,
  verifyDocuments,
  type FailedDocument,
  type RejectedDocument,
} from '../../../../services/documentRelevance';
import { DocumentRelevanceAlert } from '../../../../components/documents/DocumentRelevanceAlert';
import type { PendingDocument, PostCaseState } from '../types';
import { colors } from '../../../../theme';
import { startTrace } from '../../../../utils/perfTrace';
import type { PerfTrace } from '../../../../utils/perfTrace';
import { useT } from '../../../../i18n/useT';
import i18n from '../../../../i18n';
import { displayLabel } from '../../../../i18n/labels';

// Only while the session is still processing. The backend pushes no socket
// event for AI sessions, so this sets how soon a finished result shows up
// (on average half the interval).
const POLL_INTERVAL_MS = 1000;

const makeRequestId = (): string => {
  let random = '';
  for (let i = 0; i < 12; i += 1) {
    random += Math.floor(Math.random() * 36).toString(36);
  }
  return `pc-${Date.now().toString(36)}-${random}`;
};

interface DocumentsStepProps {
  state: PostCaseState;
  onChange: (patch: Partial<PostCaseState>) => void;
  onExtracted: (sessionId: string) => void;
}

const ModeCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  highlighted?: boolean;
  onPress: () => void;
}> = ({ title, description, icon, highlighted = false, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${description}`}
    className={`mb-3 flex-row items-center rounded-card border p-4 active:opacity-80 ${
      highlighted ? 'bg-card' : 'bg-surface'
    }`}
  >
    <View
      className={`mr-3 h-11 w-11 items-center justify-center rounded-full ${
        highlighted ? 'bg-gold-muted' : 'bg-surface-alt'
      }`}
    >
      {icon}
    </View>

    <View className="mr-1 flex-1">
      <GenieText
        variant="body-lg"
        tone={highlighted ? 'gold' : 'primary'}
        className="font-bold"
      >
        {title}
      </GenieText>
      <GenieText variant="caption" tone="muted" className="mt-0.5">
        {description}
      </GenieText>
    </View>

    <ChevronRightIcon
      size={18}
      color={highlighted ? colors.gold : colors.textSecondary}
    />
  </Pressable>
);

const ActionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  tone?: 'gold' | 'error';
  disabled?: boolean;
  onPress: () => void;
}> = ({ label, icon, tone = 'gold', disabled = false, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    className={`min-h-touch flex-1 flex-row items-center justify-center gap-2 ${
      disabled ? 'opacity-40' : 'active:opacity-70'
    }`}
  >
    {icon}
    <GenieText
      variant="body-md"
      tone={tone === 'error' ? 'error' : 'gold'}
      className="font-medium"
    >
      {label}
    </GenieText>
  </Pressable>
);

// Documents are not stored until "Submit Case", so never say "Uploaded".
const PendingStatus: React.FC = () => {
  const { t } = useT();
  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <ClockIcon size={13} color={colors.textSecondary} />
      <GenieText variant="caption" tone="muted">
        {t('client:postCase.docs.readyToSubmit')}
      </GenieText>
    </View>
  );
};

const PendingDocumentCard: React.FC<{
  document: PendingDocument;
  onReplace: () => void;
  onRemove: () => void;
}> = ({ document, onReplace, onRemove }) => {
  const { t } = useT();
  return (
  <View
    testID="pending-acknowledgement"
    className="rounded-card bg-card p-4"
  >
    <View className="flex-row items-center">
      <View className="mr-3 h-14 w-14 items-center justify-center rounded-full bg-gold-muted">
        <FileIcon size={24} color={colors.gold} />
      </View>

      <View className="flex-1">
        <GenieText variant="body-lg" numberOfLines={2}>
          {document.name}
        </GenieText>
        <GenieText variant="body-sm" tone="muted" className="mt-0.5">
          {formatFileSize(document.size)}
        </GenieText>
        {relevanceLabel(document.file) ? (
          <GenieText variant="caption" tone="success" className="mt-0.5">
            {`✓ ${relevanceLabel(document.file)}`}
          </GenieText>
        ) : null}
        <PendingStatus />
      </View>
    </View>

    <View className="my-3 h-px bg-border" />

    <View className="flex-row">
      <ActionButton
        label={t('client:postCase.docs.replace')}
        icon={<RefreshIcon size={18} color={colors.gold} />}
        onPress={onReplace}
      />
      <ActionButton
        label={t('client:postCase.docs.remove')}
        tone="error"
        icon={<TrashIcon size={18} color={colors.error} />}
        onPress={onRemove}
      />
    </View>
  </View>
  );
};

export const DocumentsStep: React.FC<DocumentsStepProps> = ({
  state,
  onChange,
  onExtracted,
}) => {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  // Relevance check of a manually chosen document.
  const [checkingName, setCheckingName] = useState<string | null>(null);
  const [failedCheck, setFailedCheck] = useState<FailedDocument | null>(null);
  const [rejected, setRejected] = useState<RejectedDocument[]>([]);

  const [uploadFraction, setUploadFraction] = useState(0);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [preparingLabel, setPreparingLabel] = useState<string | null>(null);

  const requestId = useRef(makeRequestId());

  const sessionId = state.aiSessionId;

  const sessionQuery = useQuery({
    queryKey: ['ai', 'session', sessionId],
    queryFn: () => aiApi.getSession(sessionId as string),
    enabled: Boolean(sessionId),
    refetchInterval: query =>
      query.state.data?.status === 'processing' ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const session = sessionQuery.data;

  // Times the AI-processing wait as the user experiences it: from the first
  // time this screen sees the session processing until it finishes.
  const processingTraceRef = useRef<PerfTrace | null>(null);
  useEffect(() => {
    if (session?.status === 'processing' && !processingTraceRef.current) {
      processingTraceRef.current = startTrace('ai-processing-wait');
    } else if (session && session.status !== 'processing' && processingTraceRef.current) {
      processingTraceRef.current.mark(session.status);
      processingTraceRef.current.end();
      processingTraceRef.current = null;
    }
  }, [session]);

  const deliveredRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      session?.status === 'extracted' &&
      sessionId &&
      deliveredRef.current !== sessionId
    ) {
      deliveredRef.current = sessionId;
      onExtracted(sessionId);
    }
  }, [onExtracted, session?.status, sessionId]);

  // The AI checks the document belongs to the case before it is accepted.
  // Only an accepted document is kept (still only on this device).
  const verifyAcknowledgement = useCallback(
    async (file: PickedFile) => {
      setFailedCheck(null);
      setCheckingName(file.name);
      onChange({ documentsVerifying: true });
      try {
        const outcome = await verifyDocuments([file], relevanceContextOf(state));
        if (outcome.accepted[0]) {
          onChange({
            document: toPendingDocument(outcome.accepted[0]),
            entryMode: 'manual',
            documentsVerifying: false,
          });
          return;
        }
        onChange({ documentsVerifying: false });
        setRejected(outcome.rejected);
        setFailedCheck(outcome.failed[0] ?? null);
      } finally {
        setCheckingName(null);
      }
    },
    [onChange, state],
  );

  // Choosing a document only keeps it on this device. It is uploaded when
  // the client presses "Submit Case", together with the case.
  const chooseAcknowledgement = useCallback(async () => {
    if (checkingName) {
      return;
    }
    setError(null);

    let picked: PickedFile[];
    try {
      picked = await filePicker.pickDocuments(1);
    } catch (pickError) {
      setError(toAppError(pickError).message);
      return;
    }

    const file = (await rejectOversizedDocuments(picked)).accepted[0];
    if (!file) {
      return;
    }

    const rejection = rejectionReasonFor(file);
    if (rejection) {
      setError(rejection);
      return;
    }

    await verifyAcknowledgement(file);
  }, [checkingName, verifyAcknowledgement]);

  const removeAcknowledgement = useCallback(() => {
    setError(null);
    onChange({ document: null });
  }, [onChange]);

  const [verifyingLabel, setVerifyingLabel] = useState<string | null>(null);

  const startAnalysis = useCallback(async () => {
    if (isStartingAnalysis) {
      return;
    }

    setError(null);

    let picked: PickedFile[];
    try {
      picked = await filePicker.pickDocuments(UPLOAD_LIMITS.maxDocuments);
    } catch (pickError) {
      setError(toAppError(pickError).message);
      return;
    }

    picked = (await rejectOversizedDocuments(picked)).accepted;
    if (picked.length === 0) {
      return;
    }

    setIsStartingAnalysis(true);
    setUploadFraction(0);

    let accepted: PickedFile[];
    let rejections: string[];
    try {
      ({ ready: accepted, rejections } = await prepareAiFiles(picked, progress =>
        setPreparingLabel(progressLabel(progress)),
      ));
    } finally {
      setPreparingLabel(null);
    }

    if (accepted.length === 0) {
      setIsStartingAnalysis(false);
      setError(rejections.join('\n'));
      return;
    }

    // Only documents the AI accepts as relevant are read and kept.
    let outcome;
    try {
      setVerifyingLabel(i18n.t('client:postCase.docs.checkingFirst', { total: accepted.length }));
      outcome = await verifyDocuments(
        accepted,
        relevanceContextOf(state),
        (_file, done, total) =>
          setVerifyingLabel(
            done < total
              ? i18n.t('client:postCase.docs.checkingN', { current: done + 1, total })
              : i18n.t('client:postCase.docs.checked'),
          ),
      );
    } finally {
      setVerifyingLabel(null);
    }
    setRejected(outcome.rejected);
    const notices = [
      ...rejections,
      ...outcome.failed.map(item =>
        i18n.t('client:postCase.docs.nameMessage', { name: item.file.name, message: item.message }),
      ),
    ];
    accepted = outcome.accepted;
    if (accepted.length === 0) {
      setIsStartingAnalysis(false);
      setError(
        [
          outcome.failed.length > 0 && outcome.rejected.length === 0
            ? verificationFailedMessage()
            : noRelevantDocumentMessage(),
          ...notices,
        ].join('\n'),
      );
      return;
    }
    rejections = notices;

    try {
      const accepted202 = await aiApi.analyze({
        documents: accepted,
        issueDescription: state.description,
        requestId: requestId.current,
        onUploadProgress: setUploadFraction,
      });

      // The assistant reads temporary copies; the documents themselves stay
      // pending here until the case is submitted.
      onChange({
        aiSessionId: accepted202.sessionId,
        aiFiles: accepted.map(toPendingDocument),
        entryMode: 'ai',
      });
      if (rejections.length > 0) {
        setError(rejections.join('\n'));
      }
    } catch (analyzeError) {
      setError(toAppError(analyzeError).message);
    } finally {
      setIsStartingAnalysis(false);
    }
  }, [isStartingAnalysis, onChange, state]);

  const abandonAnalysis = useCallback(() => {
    deliveredRef.current = null;
    requestId.current = makeRequestId();
    onChange({ aiSessionId: null, aiFiles: [], aiDocuments: [], entryMode: null });
  }, [onChange]);

  const isAnalysisPending =
    Boolean(sessionId) &&
    state.aiDocuments.length === 0 &&
    session?.status !== 'failed' &&
    !sessionQuery.isError;

  const relevanceAlert = (
    <DocumentRelevanceAlert
        rejected={rejected}
        onClose={() => setRejected([])}
        onChooseAnother={() => {
          setRejected([]);
          if (state.entryMode === 'ai') {
            void startAnalysis();
          } else {
            void chooseAcknowledgement();
          }
        }}
      />
  );

  if (isAnalysisPending) {
    return (
      <AiProcessingPanel
        percent={session?.progress?.percent ?? 0}
        message={session?.progress?.message || t('client:postCase.docs.preparing')}
        current={session?.progress?.current}
        total={session?.progress?.total}
        stage={
          session?.status === 'extracted'
            ? 'completed'
            : session?.progress?.stage
        }
      />
    );
  }

  if (isStartingAnalysis) {
    return (
      <>
      {relevanceAlert}
      <AiProcessingPanel
        percent={preparingLabel || verifyingLabel ? 0 : Math.round(uploadFraction * 100)}
        message={
          preparingLabel ??
          (verifyingLabel
            ? t('client:postCase.docs.analyzingWithLabel', { label: verifyingLabel })
            : t('client:postCase.docs.uploading'))
        }
        current={null}
        total={null}
        uploading
      />
      </>
    );
  }

  if (sessionId && session?.status === 'failed') {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-error-surface">
          <SparkleIcon size={28} color={colors.error} />
        </View>
        <GenieText variant="heading-sm" className="mt-4 text-center">
          {t('client:postCase.docs.failedTitle')}
        </GenieText>
        <GenieText variant="body-md" tone="secondary" className="mt-2 text-center">
          {session.failureReason ||
            t('client:postCase.docs.failedDefault')}
        </GenieText>
        <View className="mt-6 w-full gap-3">
          <GenieButton label={t('client:postCase.docs.tryAgain')} onPress={abandonAnalysis} />
          <GenieButton
            label={t('client:postCase.docs.enterManually')}
            variant="outline"
            onPress={() => {
              abandonAnalysis();
              onChange({ entryMode: 'manual' });
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-6 pt-5"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {state.entryMode === null ? (
        <>
          <GenieText variant="heading-lg">{t('client:postCase.docs.addTitle')}</GenieText>
          <GenieText variant="body-sm" tone="secondary" className="mb-4 mt-1">
            {t('client:postCase.docs.addSubtitle')}
          </GenieText>

          <ModeCard
            title={t('client:postCase.docs.withAi')}
            description={t('client:postCase.docs.withAiDescription')}
            icon={<SparkleIcon size={22} color={colors.gold} />}
            highlighted
            onPress={startAnalysis}
          />

          <ModeCard
            title={t('client:postCase.docs.manual')}
            description={t('client:postCase.docs.manualDescription')}
            icon={<FileIcon size={22} color={colors.textSecondary} />}
            onPress={() => onChange({ entryMode: 'manual' })}
          />
        </>
      ) : state.entryMode === 'ai' && state.aiFiles.length > 0 && state.aiDocuments.length > 0 ? (
        <>
          <GenieText variant="heading-lg">{t('client:postCase.docs.readTitle')}</GenieText>
          <GenieText variant="body-sm" tone="secondary" className="mb-4 mt-1">
            {t('client:postCase.docs.readSubtitle')}
          </GenieText>

          {state.aiFiles.map(document => {
            const quality = state.aiDocuments.find(
              read => read.originalName === document.name,
            )?.ocrQuality;
            return (
              <View
                key={document.id}
                className="mb-3 flex-row items-center rounded-card bg-card p-4"
              >
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-gold-muted">
                  <FileIcon size={20} color={colors.gold} />
                </View>
                <View className="flex-1">
                  <GenieText variant="body-md" numberOfLines={1}>
                    {document.name}
                  </GenieText>
                  <GenieText variant="caption" tone="muted" className="mt-0.5">
                    {formatFileSize(document.size)}
                    {quality && quality !== 'Pending'
                      ? t('client:postCase.docs.readability', {
                          quality: displayLabel('client:postCase.docs.quality', quality),
                        })
                      : ''}
                  </GenieText>
                  <PendingStatus />
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={abandonAnalysis}
            accessibilityRole="button"
            className="mt-2 min-h-touch items-center justify-center active:opacity-70"
          >
            <GenieText variant="body-sm" tone="secondary">
              {t('client:postCase.docs.startOver')}
            </GenieText>
          </Pressable>
        </>
      ) : state.entryMode === 'ai' ? (
        <>
          <GenieText variant="heading-lg">{t('client:postCase.docs.withAi')}</GenieText>
          <GenieText variant="body-sm" tone="secondary" className="mb-4 mt-1">
            {t('client:postCase.docs.aiSubtitle')}
          </GenieText>

          <Pressable
            onPress={startAnalysis}
            accessibilityRole="button"
            accessibilityLabel={t('client:postCase.docs.chooseForAiA11y')}
            className="items-center justify-center rounded-card border border-dashed bg-card px-5 py-10 active:opacity-80"
          >
            <View className="h-14 w-14 items-center justify-center rounded-full bg-gold-muted">
              <SparkleIcon size={26} color={colors.gold} />
            </View>
            <GenieText variant="body-lg" className="mt-3 font-semibold">
              {t('client:postCase.docs.chooseDocuments')}
            </GenieText>
            <GenieText variant="caption" tone="muted" className="mt-1 text-center">
              {t('client:postCase.docs.aiLimits', {
                max: UPLOAD_LIMITS.maxDocuments,
                types: UPLOAD_LIMITS.documentExtensions.join(' · '),
                size: formatFileSize(MAX_DOCUMENT_SIZE),
              })}
            </GenieText>
          </Pressable>

          <Pressable
            onPress={() => onChange({ entryMode: 'manual' })}
            accessibilityRole="button"
            className="mt-4 min-h-touch items-center justify-center active:opacity-70"
          >
            <GenieText variant="body-sm" tone="secondary">
              {t('client:postCase.docs.orManual')}
            </GenieText>
          </Pressable>
        </>
      ) : (
        <>
          <View className="flex-row items-center gap-2">
            <GenieText variant="heading-lg">{t('client:postCase.docs.ackTitle')}</GenieText>
            <GenieText variant="heading-lg" tone="error">
              *
            </GenieText>
          </View>
          <GenieText variant="body-sm" tone="secondary" className="mb-4 mt-1">
            {t('client:postCase.docs.ackSubtitle')}
          </GenieText>

          {state.document ? (
            <PendingDocumentCard
              document={state.document}
              onReplace={() => {
                void chooseAcknowledgement();
              }}
              onRemove={removeAcknowledgement}
            />
          ) : checkingName ? (
            <View
              testID="acknowledgement-checking"
              accessibilityLiveRegion="polite"
              className="items-center justify-center rounded-card border border-dashed bg-card px-5 py-10"
            >
              <ActivityIndicator size="large" color={colors.gold} />
              <GenieText variant="body-lg" className="mt-3 font-semibold">
                {t('client:postCase.docs.analyzing')}
              </GenieText>
              <GenieText variant="caption" tone="muted" className="mt-1 text-center">
                {t('client:postCase.docs.checkingNamed', { name: checkingName })}
              </GenieText>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                void chooseAcknowledgement();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('client:postCase.docs.chooseDocumentA11y')}
              className="items-center justify-center rounded-card border border-dashed bg-card px-5 py-10 active:opacity-80"
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-gold-muted">
                <UploadArrowIcon size={24} color={colors.gold} />
              </View>
              <GenieText variant="body-lg" className="mt-3 font-semibold">
                {t('client:postCase.docs.chooseFile')}
              </GenieText>
              <GenieText
                variant="caption"
                tone="muted"
                className="mt-1 text-center"
              >
                {t('client:postCase.docs.manualLimits', {
                  types: UPLOAD_LIMITS.documentExtensions.join(' · '),
                })}
              </GenieText>
            </Pressable>
          )}

          <Pressable
            onPress={startAnalysis}
            accessibilityRole="button"
            className="mt-4 flex-row items-center justify-center gap-2 rounded-card bg-card p-3 active:opacity-80"
          >
            <SparkleIcon size={18} color={colors.gold} />
            <GenieText variant="body-sm" tone="gold" className="font-semibold">
              {t('client:postCase.docs.orAi')}
            </GenieText>
          </Pressable>
        </>
      )}

      {failedCheck && !checkingName ? (
        <View className="mt-4" testID="acknowledgement-check-failed">
          <GenieNotice tone="error" message={failedCheck.message} />
          <View className="mt-3 flex-row gap-3">
            <GenieButton
              label={t('client:postCase.docs.tryAgain')}
              onPress={() => {
                void verifyAcknowledgement(failedCheck.file);
              }}
              className="flex-1"
            />
            <GenieButton
              label={t('client:postCase.docs.remove')}
              variant="outline"
              onPress={() => setFailedCheck(null)}
              className="flex-1"
            />
          </View>
        </View>
      ) : null}

      {error ? (
        <GenieNotice tone="error" message={error} className="mt-4" />
      ) : null}

      {sessionQuery.isError && sessionId ? (
        <GenieNotice
          tone="error"
          className="mt-4"
          message={sessionQuery.error.message}
        />
      ) : null}

      {relevanceAlert}
    </ScrollView>
  );
};
