import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import {
  GenieButton,
  GenieDocumentCard,
  GenieErrorState,
  GenieHeader,
  GenieNotice,
  GenieText,
} from '../../../components';
import { AlertIcon } from '../../../components/icons/Icons';
import { SparkleIcon } from '../../../components/icons/ClientIcons';
import { aiApi } from '../../../api/aiApi';
import { formatDate } from '../../../utils/format';
import type { AiSessionDetail } from '../../../types/ai';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { USE_NATIVE_DRIVER } from '../../../utils/platform';
import { useT } from '../../../i18n/useT';
import { categoryLabel, displayLabel, subTypeLabel } from '../../../i18n/labels';

// Only while the session is still processing.
const POLL_INTERVAL_MS = 4000;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View className="mt-5">
    <GenieText
      variant="caption"
      tone="gold"
      className="mb-2 font-bold uppercase tracking-widest"
    >
      {title}
    </GenieText>
    <View className="rounded-card bg-surface p-4">
      {children}
    </View>
  </View>
);

const Field: React.FC<{
  label: string;
  value?: string | null;
  flagged?: boolean;
}> = ({ label, value, flagged = false }) => {
  const { t } = useT();
  if (!value) {
    return null;
  }

  return (
    <View className="mb-3">
      <View className="flex-row items-center gap-1.5">
        <GenieText variant="caption" tone="muted">
          {label}
        </GenieText>
        {flagged ? (
          <View className="rounded-pill bg-warning-surface px-1.5 py-0.5">
            <GenieText variant="caption" tone="warning" className="text-small-label font-bold">
              {t('assistant:session.check')}
            </GenieText>
          </View>
        ) : null}
      </View>
      <GenieText variant="body-sm" className="mt-0.5">
        {value}
      </GenieText>
    </View>
  );
};

const ProcessingView: React.FC<{
  percent: number;
  message: string;
  current?: number | null;
  total?: number | null;
}> = ({ percent, message, current, total }) => {
  const { t } = useT();
  const pulse = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [percent, width]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Animated.View
        style={{ transform: [{ scale }] }}
        className="h-20 w-20 items-center justify-center rounded-full bg-gold-muted"
      >
        <SparkleIcon size={34} color={colors.gold} />
      </Animated.View>

      <GenieText variant="heading-sm" className="mt-5 text-center">
        {message}
      </GenieText>

      {typeof current === 'number' && typeof total === 'number' && total > 0 ? (
        <GenieText variant="body-sm" tone="secondary" className="mt-1">
          {t('assistant:session.progress', { current, total })}
        </GenieText>
      ) : null}

      <View className="mt-5 h-1.5 w-full overflow-hidden rounded-pill bg-surface-alt">
        <Animated.View
          className="h-full rounded-pill bg-gold"
          style={{
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>

      <GenieText variant="body-sm" tone="gold" className="mt-2 font-bold">
        {Math.round(percent)}%
      </GenieText>

      <GenieText variant="caption" tone="muted" className="mt-5 text-center">
        {t('assistant:session.leaveScreenHint')}
      </GenieText>
    </View>
  );
};

const FailedView: React.FC<{
  reason: string;
  onRetry: () => void;
  onBack: () => void;
}> = ({ reason, onRetry, onBack }) => {
  const { t } = useT();
  return (
  <View className="flex-1 items-center justify-center px-6">
    <View className="h-16 w-16 items-center justify-center rounded-full bg-error-surface">
      <AlertIcon size={28} color={colors.error} />
    </View>

    <GenieText variant="heading-sm" className="mt-4 text-center">
      {t('assistant:session.failedTitle')}
    </GenieText>

    <GenieText variant="body-md" tone="secondary" className="mt-2 text-center">
      {reason || t('assistant:session.failedDefault')}
    </GenieText>

    <View className="mt-6 w-full gap-3">
      <GenieButton label={t('assistant:session.tryAgain')} onPress={onRetry} />
      <GenieButton label={t('assistant:session.goBack')} variant="outline" onPress={onBack} />
    </View>
  </View>
  );
};

const ResultView: React.FC<{ session: AiSessionDetail }> = ({ session }) => {
  const { t } = useT();
  const data = session.extracted;

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <GenieText variant="heading-sm" className="text-center">
          {t('assistant:session.nothingExtracted')}
        </GenieText>
        <GenieText variant="body-md" tone="secondary" className="mt-2 text-center">
          {t('assistant:session.nothingExtractedHint')}
        </GenieText>
      </View>
    );
  }

  const needsReview = new Set(data.needsReview ?? []);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-10"
      showsVerticalScrollIndicator={false}
    >
      <View className="mt-2 flex-row items-center self-start rounded-pill bg-gold-muted px-2 py-1">
        <SparkleIcon size={13} color={colors.gold} />
        <GenieText
          variant="caption"
          tone="gold"
          className="ml-1 font-bold tracking-widest"
        >
          {t('assistant:session.complete')}
        </GenieText>
      </View>

      {data.title ? (
        <GenieText variant="heading-lg" className="mt-3">
          {data.title}
        </GenieText>
      ) : null}

      {data.summary ? (
        <Section title={t('assistant:session.understood')}>
          <GenieText variant="body-sm" tone="secondary">
            {data.summary}
          </GenieText>
        </Section>
      ) : null}

      <Section title={t('assistant:session.caseDetails')}>
        <Field
          label={t('assistant:session.category')}
          value={categoryLabel(data.category)}
          flagged={needsReview.has('category')}
        />
        <Field
          label={t('assistant:session.subType')}
          value={subTypeLabel(data.subType)}
          flagged={needsReview.has('subType')}
        />
        <Field
          label={t('assistant:session.urgency')}
          value={displayLabel('cases:urgency', data.urgency)}
          flagged={needsReview.has('urgency')}
        />
        <Field
          label={t('assistant:session.location')}
          value={data.location || data.city}
          flagged={needsReview.has('city')}
        />
        <Field label={t('assistant:session.state')} value={data.state} />
        <Field label={t('assistant:session.court')} value={data.court} flagged={needsReview.has('court')} />
        <Field
          label={t('assistant:session.incidentDate')}
          value={formatDate(data.incidentDate)}
          flagged={needsReview.has('incidentDate')}
        />
        <Field
          label={t('assistant:session.otherParty')}
          value={data.opposingParty}
          flagged={needsReview.has('opposingParty')}
        />
        <Field
          label={t('assistant:session.claimAmount')}
          value={
            typeof data.claimAmount === 'number' ? String(data.claimAmount) : ''
          }
        />
        <Field label={t('assistant:session.firNumber')} value={data.firNumber} />
        <Field label={t('assistant:session.policeStation')} value={data.policeStation} />
        <Field label={t('assistant:session.bailDetails')} value={data.bailDetails} />
      </Section>

      {data.description ? (
        <Section title={t('assistant:session.draftDescription')}>
          <GenieText variant="body-sm" tone="secondary">
            {data.description}
          </GenieText>
        </Section>
      ) : null}

      {data.parties?.length ? (
        <Section title={t('assistant:session.partiesNamed')}>
          {data.parties.map((party, index) => (
            <View key={`${party.name}-${index}`} className="mb-3">
              <GenieText variant="body-sm">{party.name}</GenieText>
              {party.role ? (
                <GenieText variant="caption" tone="muted">
                  {party.role}
                </GenieText>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}

      {session.voiceTranscript ? (
        <Section
          title={
            session.voiceTranscriptSource === 'server'
              ? t('assistant:session.voiceTranscriptServer')
              : t('assistant:session.voiceTranscript')
          }
        >
          <GenieText variant="body-sm" tone="secondary">
            {session.voiceTranscript}
          </GenieText>
        </Section>
      ) : session.voiceTranscriptionFailed ? (
        <Section title={t('assistant:session.voiceNote')}>
          <GenieText variant="body-sm" tone="warning">
            {t('assistant:session.voiceFailed')}
          </GenieText>
        </Section>
      ) : null}

      {session.uploadedDocuments?.length ? (
        <Section title={t('assistant:session.documentsRead', { count: session.uploadedDocuments.length })}>
          {session.uploadedDocuments.map((document, index) => (
            <GenieDocumentCard
              key={`${document.originalName}-${index}`}
              name={document.originalName}
              size={document.size}
              state="idle"
            />
          ))}
        </Section>
      ) : null}

      {needsReview.size > 0 ? (
        <GenieNotice
          tone="warning"
          className="mt-5"
          message={
            needsReview.size === 1
              ? t('assistant:session.oneFieldCheck')
              : t('assistant:session.fieldsCheck', { count: needsReview.size })
          }
        />
      ) : null}

      <View className="mt-5">
        <GenieText variant="caption" tone="muted" className="text-center">
          {t('assistant:session.comingSoon')}
        </GenieText>
      </View>
    </ScrollView>
  );
};

export const AiSessionScreen: React.FC<ClientStackScreenProps<'AiSession'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const { sessionId } = route.params;

  const sessionQuery = useQuery({
    queryKey: ['ai', 'session', sessionId],
    queryFn: () => aiApi.getSession(sessionId),
    refetchInterval: query =>
      query.state.data?.status === 'processing' ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const session = sessionQuery.data;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('assistant:session.title')}
        subtitle={
          session?.status === 'processing'
            ? t('assistant:session.working')
            : undefined
        }
        onBack={() => navigation.goBack()}
      />

      {sessionQuery.isPending ? (
        <ProcessingView percent={0} message={t('assistant:session.loading')} />
      ) : sessionQuery.isError ? (
        <View className="px-4">
          <GenieErrorState
            message={sessionQuery.error.message}
            onRetry={() => sessionQuery.refetch()}
          />
        </View>
      ) : session?.status === 'processing' ? (
        <ProcessingView
          percent={session.progress?.percent ?? 0}
          message={session.progress?.message || t('assistant:session.analysing')}
          current={session.progress?.current}
          total={session.progress?.total}
        />
      ) : session?.status === 'failed' ? (
        <FailedView
          reason={session.failureReason || ''}
          onRetry={() => navigation.replace('AiAssistant')}
          onBack={() => navigation.goBack()}
        />
      ) : session ? (
        <ResultView session={session} />
      ) : null}
    </SafeAreaView>
  );
};
