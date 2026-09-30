import React, { useCallback, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { GenieButton, GenieHeader, GenieModal, GenieText } from '../../../components';
import { aiApi } from '../../../api/aiApi';
import { casesApi } from '../../../api/casesApi';
import { caseDraftFiles } from '../../../services/caseDraftFiles';
import { categoryById } from '../../../services/legalCategories';
import { toAppError } from '../../../utils/errors';
import { isWeb } from '../../../utils/platform';
import { PostCaseStepper } from './PostCaseStepper';
import { CategoryStep } from './steps/CategoryStep';
import { DetailsStep } from './steps/DetailsStep';
import { DocumentsStep } from './steps/DocumentsStep';
import { LawyersStep } from './steps/LawyersStep';
import { ReviewStep } from './steps/ReviewStep';
import {
  applyExtraction,
  documentsToSubmit,
  initialPostCaseState,
  isStepComplete,
  REQUIRED_LAWYER_COUNT,
  toCreatePayload,
  toPendingDocument,
  type PostCaseState,
  type PostCaseStepIndex,
} from './types';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { useT } from '../../../i18n/useT';

const LAST_STEP: PostCaseStepIndex = 4;

export const PostCaseScreen: React.FC<ClientStackScreenProps<'PostCase'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const handoffSessionId = route.params?.sessionId ?? null;
  const startMode = handoffSessionId
    ? 'ai'
    : route.params?.start ?? 'manual';

  const presetCategory = route.params?.categoryId
    ? categoryById(route.params.categoryId)
    : undefined;

  const [state, setState] = useState<PostCaseState>(() => ({
    ...initialPostCaseState,
    ...route.params?.prefill,
    categoryId: presetCategory?.id ?? '',
    category: presetCategory?.title ?? '',
    entryMode: startMode === 'ai' ? 'ai' : 'manual',
    aiSessionId: handoffSessionId,
    // Documents chosen in the AI assistant, still only on this device.
    aiFiles: caseDraftFiles.take(handoffSessionId).map(toPendingDocument),
  }));

  const [step, setStep] = useState<PostCaseStepIndex>(
    startMode === 'ai' ? 2 : 0,
  );
  const [furthest, setFurthest] = useState<PostCaseStepIndex>(
    startMode === 'ai' ? 2 : 0,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadFraction, setUploadFraction] = useState(0);
  const [isExitPromptOpen, setIsExitPromptOpen] = useState(false);

  const [hasAgreed, setHasAgreed] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const change = useCallback((patch: Partial<PostCaseState>) => {
    setState(current => ({ ...current, ...patch }));
  }, []);

  const markEdited = useCallback((field: string) => {
    setState(current =>
      current.aiFields.includes(field)
        ? {
            ...current,
            aiFields: current.aiFields.filter(f => f !== field),
            aiNeedsReview: current.aiNeedsReview.filter(f => f !== field),
          }
        : current,
    );
  }, []);

  const goTo = useCallback((next: PostCaseStepIndex) => {
    setStep(next);
    setFurthest(current => (next > current ? next : current));
  }, []);

  const appliedSessionsRef = useRef<Set<string>>(new Set());

  const advanceAfterExtraction = useCallback(
    async (sessionId: string) => {
      if (appliedSessionsRef.current.has(sessionId)) {
        return;
      }

      let session;
      try {
        session = await aiApi.getSession(sessionId);
      } catch {
        return;
      }

      if (!session.extracted) {
        return;
      }

      appliedSessionsRef.current.add(sessionId);

      const next = applyExtraction(
        stateRef.current,
        session.extracted,
        session.uploadedDocuments ?? [],
        sessionId,
        session.voiceTranscript ?? '',
        session.extractionWarnings ?? [],
      );

      setState(next);

      const firstGap = ([0, 1, 2] as PostCaseStepIndex[]).find(
        candidate => !isStepComplete(next, candidate),
      );

      goTo(firstGap ?? 3);
    },
    [goTo],
  );

  const clientRequestIdRef = useRef(
    `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const isSubmittingRef = useRef(false);

  const submitMutation = useMutation({
    // The single commit point: the case and its documents are sent together,
    // and the server stores the documents only as part of creating the case.
    mutationFn: () => {
      setUploadFraction(0);
      return casesApi.submit({
        payload: toCreatePayload(state, clientRequestIdRef.current),
        documents: documentsToSubmit(state).map(document => document.file),
        onUploadProgress: setUploadFraction,
      });
    },
    onSuccess: async created => {
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });

      navigation.replace('CaseDetails', {
        caseId: created._id,
        title: created.title,
      });
    },
    onError: error => {
      isSubmittingRef.current = false;
      setSubmitError(toAppError(error).message);
    },
  });

  const submit = () => {
    if (isSubmittingRef.current || submitMutation.isPending) {
      return;
    }
    if (!isStepComplete(state, 3)) {
      setSubmitError(t('client:postCase.selectExactly', { count: REQUIRED_LAWYER_COUNT }));
      goTo(3);
      return;
    }
    isSubmittingRef.current = true;
    setSubmitError(null);
    submitMutation.mutate();
  };

  const hasProgress =
    Boolean(state.subcategory) ||
    Boolean(state.description.trim()) ||
    documentsToSubmit(state).length > 0 ||
    Boolean(state.aiSessionId);

  const attemptExit = useCallback(() => {
    if (submitMutation.isPending) {
      return true;
    }
    if (hasProgress) {
      setIsExitPromptOpen(true);
      return true;
    }
    navigation.goBack();
    return true;
  }, [hasProgress, navigation, submitMutation.isPending]);

  const back = useCallback(() => {
    if (step === 0) {
      attemptExit();
      return;
    }
    setStep(current => (current - 1) as PostCaseStepIndex);
  }, [attemptExit, step]);

  const backRef = useRef(back);
  backRef.current = back;

  useFocusEffect(
    useCallback(() => {
      if (isWeb) {
        return undefined;
      }

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          backRef.current();
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );

  const canContinue = isStepComplete(state, step);

  const pendingCount = documentsToSubmit(state).length;
  const submitLabel =
    pendingCount === 0 || uploadFraction >= 1
      ? t('client:postCase.finalizing')
      : t('client:postCase.uploadingDocs', {
          count: pendingCount,
          percent: Math.round(uploadFraction * 100),
        });

  const nextHint = (): string => {
    switch (step) {
      case 0:
        return state.category
          ? t('client:postCase.hintSubType')
          : t('client:postCase.hintCategory');
      case 1:
        return t('client:postCase.hintDetails');
      case 2:
        return state.documentsVerifying
          ? t('client:postCase.hintChecking')
          : t('client:postCase.hintDocument');
      case 3:
        return t('client:postCase.hintLawyers', {
          count: REQUIRED_LAWYER_COUNT,
          selected: state.selectedLawyers.length,
        });
      default:
        return '';
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <CategoryStep state={state} onChange={change} />;
      case 1:
        return (
          <DetailsStep
            state={state}
            onChange={change}
            onFieldEdited={markEdited}
          />
        );
      case 2:
        return (
          <DocumentsStep
            state={state}
            onChange={change}
            onExtracted={sessionId => {
              void advanceAfterExtraction(sessionId);
            }}
          />
        );
      case 3:
        return (
          <LawyersStep
            state={state}
            onChange={change}
            onViewProfile={(userId, name) =>
              navigation.navigate('AdvocateProfile', { userId, name })
            }
          />
        );
      case 4:
        return (
          <ReviewStep
            state={state}
            onEditStep={goTo}
            onViewLawyerProfile={(userId, name) =>
              navigation.navigate('AdvocateProfile', { userId, name })
            }
            submitError={submitError}
            hasAgreed={hasAgreed}
            onAgreedChange={setHasAgreed}
            onOpenTerms={() => navigation.navigate('TermsConditions')}
            onOpenPrivacy={() => navigation.navigate('PrivacyPolicy')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader title={t('client:postCase.title')} onBack={back} />

      <PostCaseStepper currentIndex={step} furthestIndex={furthest} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {renderStep()}

        <View
          className="bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row gap-3">
            {step > 0 ? (
              <GenieButton
                label={t('client:postCase.back')}
                variant="outline"
                onPress={back}
                disabled={submitMutation.isPending}
                className="flex-1"
              />
            ) : null}

            {step === LAST_STEP ? (
              <View className="flex-1">
                <GenieButton
                  testID="submit-case-button"
                  label={t('client:postCase.submit')}
                  loadingLabel={submitLabel}
                  loading={submitMutation.isPending}
                  disabled={!hasAgreed || submitMutation.isPending}
                  onPress={submit}
                />
                {!hasAgreed ? (
                  <GenieText
                    variant="caption"
                    tone="muted"
                    className="mt-1 text-center"
                  >
                    {t('client:postCase.acceptTerms')}
                  </GenieText>
                ) : null}
              </View>
            ) : (
              <View className="flex-1">
                <GenieButton
                  testID="post-case-next-button"
                  label={t('client:postCase.next')}
                  disabled={!canContinue}
                  onPress={() => goTo((step + 1) as PostCaseStepIndex)}
                />
                {!canContinue ? (
                  <GenieText
                    variant="caption"
                    tone="muted"
                    className="mt-1 text-center"
                  >
                    {nextHint()}
                  </GenieText>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <GenieModal
        visible={isExitPromptOpen}
        onClose={() => setIsExitPromptOpen(false)}
        title={t('client:postCase.discardTitle')}
      >
        <GenieText variant="body-md" tone="secondary">
          {t('client:postCase.discardMessage')}
        </GenieText>

        <View className="mt-5 flex-row gap-3">
          <GenieButton
            label={t('client:postCase.keepEditing')}
            variant="outline"
            onPress={() => setIsExitPromptOpen(false)}
            className="flex-1"
          />
          <GenieButton
            label={t('client:postCase.discard')}
            variant="danger"
            onPress={() => {
              setIsExitPromptOpen(false);
              navigation.goBack();
            }}
            className="flex-1"
          />
        </View>
      </GenieModal>
    </SafeAreaView>
  );
};
