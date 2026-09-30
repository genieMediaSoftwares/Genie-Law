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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import {
  GenieHeader,
  GenieNotice,
  GenieSkeletonList,
  GenieText,
  GenieAiDisclaimer,
} from '../../../components';
import {
  FileIcon,
  SendIcon,
  SparkleIcon,
} from '../../../components/icons/ClientIcons';
import { UPLOAD_LIMITS, aiApi, rejectionReasonFor } from '../../../api/aiApi';
import { filePicker } from '../../../services/filePicker';
import { rejectOversizedDocuments } from '../../../services/documentSizeGuard';
import { toAppError } from '../../../utils/errors';
import { ResearchAnswer } from './ResearchSections';
import { RelevantCasesSection } from './RelevantCasesSection';
import type { ResearchConversation } from '../../../types/lawyer';
import type { PickedFile } from '../../../types/ai';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import i18n from '../../../i18n';

// Only while research or a case search is running; see the in-flight guard below.
const POLL_INTERVAL_MS = 1000;

const SUGGESTIONS = [
  'lawyer:researchSession.suggestions.statutes',
  'lawyer:researchSession.suggestions.arguments',
  'lawyer:researchSession.suggestions.evidence',
  'lawyer:researchSession.suggestions.missingDocs',
  'lawyer:researchSession.suggestions.nextHearing',
  'lawyer:researchSession.suggestions.contested',
] as const;

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export const ResearchSessionScreen: React.FC<
  LawyerStackScreenProps<'ResearchSession'>
> = ({ navigation, route }) => {
  const { t } = useT();
  const queryClient = useQueryClient();

  const { caseId, caseTitle, caseCategory } = route.params ?? {};

  const [conversationId, setConversationId] = useState<string | undefined>(
    route.params?.sessionId,
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(
    Boolean(route.params?.sessionId),
  );
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysisStage, setAnalysisStage] = useState<string | null>(null);
  const [research, setResearch] = useState<ResearchConversation | null>(null);
  const [isStartingSearch, setIsStartingSearch] = useState(false);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const requestId = useRef(
    `rs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const lastAppliedRef = useRef<string | null>(null);

  const applyConversation = useCallback((conversation: ResearchConversation) => {
    // Polling returns the same conversation most ticks; rebuilding `turns`
    // from it re-rendered the whole transcript every second for no change.
    const snapshot = JSON.stringify(conversation);
    if (snapshot === lastAppliedRef.current) {
      return;
    }
    lastAppliedRef.current = snapshot;
    setResearch(conversation);
    setTurns(
      conversation.messages.map((message, index) => ({
        id: `${conversation.id}-${index}`,
        role: message.role === 'user' ? 'user' : 'assistant',
        text: message.text,
      })),
    );
  }, []);

  useEffect(() => {
    const existing = route.params?.sessionId;
    if (!existing) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const conversation = await aiApi.getResearchConversation(existing);
        if (!cancelled) {
          applyConversation(conversation);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(toAppError(loadError).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyConversation, route.params?.sessionId]);

  const isResearchRunning = research?.researchStatus === 'processing';
  const isSearchRunning = research?.relevantCases?.status === 'searching';

  useEffect(() => {
    if (!conversationId || (!isResearchRunning && !isSearchRunning)) {
      return;
    }
    // Skip a tick while the previous poll is still in flight, so slow
    // responses on mobile data never stack up overlapping requests.
    let inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        applyConversation(await aiApi.getResearchConversation(conversationId));
      } catch {
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [applyConversation, conversationId, isResearchRunning, isSearchRunning]);

  const searchCases = useCallback(
    async (searchInput: { query?: string; jurisdiction?: string }) => {
      if (!conversationId || isStartingSearch) {
        return;
      }
      setError(null);
      setIsStartingSearch(true);
      try {
        await aiApi.searchRelevantCases(conversationId, searchInput);
        applyConversation(await aiApi.getResearchConversation(conversationId));
      } catch (searchError) {
        setError(toAppError(searchError).message);
      } finally {
        setIsStartingSearch(false);
      }
    },
    [applyConversation, conversationId, isStartingSearch],
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isAsking) {
        return;
      }

      setError(null);
      setInput('');
      setIsAsking(true);

      const localId = `local-${Date.now()}`;
      setTurns(current => [
        ...current,
        { id: localId, role: 'user', text: trimmed },
      ]);

      try {
        const answer = await aiApi.chat({
          message: trimmed,
          conversationId,
          mode: 'research',
        });

        setTurns(current => [
          ...current,
          {
            id: `${localId}-a`,
            role: 'assistant',
            text: answer.response,
          },
        ]);

        if (answer.conversationId && answer.conversationId !== conversationId) {
          setConversationId(answer.conversationId);
        }

        await queryClient.invalidateQueries({
          queryKey: ['lawyer', 'research', 'sessions'],
        });
      } catch (askError) {
        setError(toAppError(askError).message);
      } finally {
        setIsAsking(false);
      }
    },
    [conversationId, isAsking, queryClient],
  );

  const analyseDocument = useCallback(async () => {
    if (isAsking || analysisStage) {
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

    const accepted: PickedFile[] = [];
    const rejections: string[] = [];
    for (const file of picked) {
      const reason = rejectionReasonFor(file);
      if (reason) {
        rejections.push(reason);
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length === 0) {
      setError(rejections.join('\n'));
      return;
    }

    setAnalysisStage(i18n.t('lawyer:researchSession.uploading'));

    try {
      const started = await aiApi.analyze({
        documents: accepted,
        requestId: requestId.current,
        onUploadProgress: fraction => {
          setAnalysisStage(
            fraction >= 1
              ? i18n.t('lawyer:researchSession.reading')
              : i18n.t('lawyer:researchSession.uploadingPercent', { percent: Math.round(fraction * 100) }),
          );
        },
      });

      let detail = await aiApi.getSession(started.sessionId);
      while (detail.status === 'processing') {
        setAnalysisStage(detail.progress?.message || i18n.t('lawyer:researchSession.reading'));
        await new Promise<void>(resolve => {
          setTimeout(resolve, POLL_INTERVAL_MS);
        });
        detail = await aiApi.getSession(started.sessionId);
      }

      if (detail.status === 'failed') {
        setError(
          detail.failureReason ||
            i18n.t('lawyer:researchSession.analyseFailed'),
        );
        return;
      }

      const extracted = detail.extracted;
      if (!extracted) {
        setError(
          i18n.t('lawyer:researchSession.noDetails'),
        );
        return;
      }

      setAnalysisStage(i18n.t('lawyer:researchSession.preparing'));

      const facts: string[] = [];
      const add = (label: string, value?: string | null) => {
        if (value && String(value).trim()) {
          facts.push(`${label}: ${String(value).trim()}`);
        }
      };

      add('Matter', extracted.title);
      add('Category', extracted.category);
      add('Sub-type', extracted.subType);
      add('Court', extracted.court);
      add('Location', extracted.location || extracted.city);
      add('Incident date', extracted.incidentDate);
      add('Opposing party', extracted.opposingParty);
      add('FIR number', extracted.firNumber);
      add('Police station', extracted.policeStation);
      add('Summary', extracted.summary || extracted.description);

      if (extracted.parties?.length) {
        facts.push(
          `Parties: ${extracted.parties
            .map(p => [p.name, p.role].filter(Boolean).join(' (') + (p.role ? ')' : ''))
            .join('; ')}`,
        );
      }

      const documentNames = (detail.uploadedDocuments ?? [])
        .map(d => d.originalName)
        .join(', ');

      const prompt = [
        `I have had these case documents read: ${documentNames}.`,
        'The extraction gave the following. Treat it as the facts of the matter, and tell me where it is too thin to work from.',
        '',
        facts.join('\n'),
        '',
        'Research this matter: the issues it raises, the provisions and authorities I should verify, the practical and procedural points, and what is missing.',
      ].join('\n');

      setAnalysisStage(null);
      await ask(prompt);
    } catch (analyseError) {
      setError(toAppError(analyseError).message);
    } finally {
      setAnalysisStage(null);
    }
  }, [analysisStage, ask, isAsking]);

  const hasOpenedWithCase = useRef(false);
  useEffect(() => {
    if (
      hasOpenedWithCase.current ||
      !caseId ||
      route.params?.sessionId ||
      turns.length > 0
    ) {
      return;
    }
    hasOpenedWithCase.current = true;

    const context = [
      `I am researching one of my matters: "${caseTitle}"${
        caseCategory ? ` (${caseCategory})` : ''
      }.`,
      'Set out the issues this kind of matter usually turns on, the provisions and authorities I should verify, and what facts you would need from me to take it further.',
    ].join('\n');

    void ask(context);
  }, [ask, caseCategory, caseId, caseTitle, route.params?.sessionId, turns.length]);

  const isBusy = isAsking || Boolean(analysisStage) || isResearchRunning;
  const busyLabel =
    analysisStage ??
    (isResearchRunning && research?.researchStage
      ? t('lawyer:researchSession.stage', { stage: research.researchStage })
      : t('lawyer:researchSession.researching'));
  const hasAnswer = turns.some(turn => turn.role === 'assistant');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={route.params?.title || t('lawyer:researchSession.title')}
        subtitle={caseTitle}
        onBack={() => navigation.goBack()}
      />

      <GenieAiDisclaimer className="px-4 pb-1 pt-1" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-4 pb-6 pt-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {isLoadingHistory ? (
            <GenieSkeletonList count={3} />
          ) : (
            <>
              {research?.caseTitle ? (
                <View testID="research-case-context" className="mb-4 rounded-card border border-border bg-card p-4">
                  <GenieText variant="caption" tone="muted" className="font-bold uppercase tracking-widest">
                    {t('lawyer:researchSession.case')}
                  </GenieText>
                  <GenieText variant="body-lg" className="mt-1 font-bold">
                    {research.caseTitle}
                  </GenieText>
                  {research.jurisdiction ? (
                    <GenieText variant="body-sm" tone="gold">
                      {research.jurisdiction}
                    </GenieText>
                  ) : null}
                  {research.researchDocuments.length === 0 ? (
                    <GenieText variant="body-sm" tone="secondary" className="mt-2">
                      {t('lawyer:researchSession.noDocuments')}
                    </GenieText>
                  ) : (
                    research.researchDocuments.map(doc => (
                      <View key={doc.documentId} className="mt-2 flex-row items-start gap-2">
                        <FileIcon size={14} color={colors.gold} />
                        <View className="flex-1">
                          <GenieText variant="body-sm" numberOfLines={1}>
                            {`[${doc.reference}] ${doc.name}`}
                          </GenieText>
                          <GenieText
                            variant="caption"
                            tone={doc.status === 'used' ? 'success' : doc.status === 'pending' ? 'muted' : 'warning'}
                          >
                            {doc.status === 'used'
                              ? t('lawyer:researchSession.readInFull')
                              : doc.status === 'pending'
                              ? t('lawyer:researchSession.waiting')
                              : doc.note || t('lawyer:researchSession.couldNotRead')}
                          </GenieText>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : null}

              {turns.length === 0 && !isBusy ? (
                <View>
                  <View className="rounded-card border border-border bg-card p-4">
                    <View className="flex-row items-center gap-2">
                      <SparkleIcon size={18} color={colors.gold} />
                      <GenieText variant="body-lg" tone="gold" className="font-bold">
                        {t('lawyer:researchSession.assistant')}
                      </GenieText>
                    </View>
                    <GenieText variant="body-sm" tone="secondary" className="mt-2 leading-5">
                      {t('lawyer:researchSession.assistantIntro')}
                    </GenieText>
                  </View>

                  <GenieText variant="caption" tone="muted" className="mb-2 mt-5 font-bold uppercase tracking-widest">
                    {t('lawyer:researchSession.startWith')}
                  </GenieText>

                  {SUGGESTIONS.map(suggestion => (
                    <Pressable
                      key={suggestion}
                      onPress={() => void ask(t(suggestion))}
                      accessibilityRole="button"
                      accessibilityLabel={t(suggestion)}
                      className="mb-2 min-h-touch justify-center rounded-control border border-border bg-card px-4 py-3 active:opacity-80"
                    >
                      <GenieText variant="body-sm" tone="secondary">
                        {t(suggestion)}
                      </GenieText>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {turns.map(turn =>
                turn.role === 'user' ? (
                  <View
                    key={turn.id}
                    className="mb-3 max-w-[88%] self-end rounded-card rounded-br-sm bg-gold-muted px-4 py-3"
                  >
                    <GenieText variant="body-sm" className="leading-5">
                      {turn.text}
                    </GenieText>
                  </View>
                ) : (
                  <View key={turn.id} className="mb-2">
                    <ResearchAnswer text={turn.text} />
                  </View>
                ),
              )}

              {isBusy ? (
                <View className="mb-3 flex-row items-center gap-3 rounded-card border border-border bg-card p-4">
                  <ActivityIndicator size="small" color={colors.gold} />
                  <GenieText variant="body-sm" tone="secondary" className="flex-1">
                    {busyLabel}
                  </GenieText>
                </View>
              ) : null}

              {research?.researchStatus === 'failed' && research.researchError ? (
                <GenieNotice tone="error" message={research.researchError} className="mb-3" />
              ) : null}

              {conversationId && (hasAnswer || research?.relevantCases?.status !== 'idle') ? (
                <RelevantCasesSection
                  key={conversationId}
                  state={research?.relevantCases}
                  canSearch={hasAnswer && !isBusy}
                  isStarting={isStartingSearch}
                  onSearch={searchInput => void searchCases(searchInput)}
                />
              ) : null}

              {error ? (
                <GenieNotice tone="error" message={error} className="mb-3" />
              ) : null}
            </>
          )}
        </ScrollView>

        <View className="border-t border-border bg-surface px-4 py-3">
          <View className="flex-row items-end gap-2">
            <Pressable
              onPress={() => void analyseDocument()}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:researchSession.attachA11y')}
              className={`h-11 w-11 items-center justify-center rounded-full border border-border bg-card ${
                isBusy ? 'opacity-40' : 'active:opacity-70'
              }`}
            >
              <FileIcon size={20} color={colors.gold} />
            </Pressable>

            <View className="max-h-28 flex-1 rounded-control border border-border bg-card px-4 py-2">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('lawyer:researchSession.placeholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                editable={!isBusy}
                className="max-h-24 min-h-[28px] text-body-md text-white"
                accessibilityLabel={t('lawyer:researchSession.questionA11y')}
              />
            </View>

            <Pressable
              onPress={() => void ask(input)}
              disabled={isBusy || !input.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:researchSession.send')}
              className={`h-11 w-11 items-center justify-center rounded-full bg-gold ${
                isBusy || !input.trim() ? 'opacity-40' : 'active:opacity-80'
              }`}
            >
              <SendIcon size={20} color={colors.background} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
