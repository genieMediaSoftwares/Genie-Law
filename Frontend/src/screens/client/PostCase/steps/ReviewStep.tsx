import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { GenieButton, GenieNotice, GenieText, VerifiedBadge } from '../../../../components';
import {
  ClockIcon,
  EditIcon,
  FileIcon,
  LocationIcon,
  ScalesIcon,
  SparkleIcon,
  StarIcon,
} from '../../../../components/icons/ClientIcons';
import { CheckIcon } from '../../../../components/icons/Icons';
import { formatDate, formatFileSize } from '../../../../utils/format';
import { resolveFileUrl } from '../../../../utils/urls';
import { CheckBadge } from '../AiBadge';
import { documentsToSubmit, REQUIRED_LAWYER_COUNT } from '../types';
import type { PostCaseStepIndex, PostCaseState } from '../types';
import type { RecommendedLawyer } from '../../../../types/domain';
import { colors } from '../../../../theme';
import { useT } from '../../../../i18n/useT';
import { categoryLabel, displayLabel, practiceAreaLabel, subTypeLabel } from '../../../../i18n/labels';

interface ReviewStepProps {
  state: PostCaseState;
  onEditStep: (step: PostCaseStepIndex) => void;
  onViewLawyerProfile: (userId: string, name: string) => void;
  submitError: string | null;
  hasAgreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

const Section: React.FC<{
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}> = ({ title, onEdit, children }) => {
  const { t } = useT();
  return (
  <View className="mt-4">
    <View className="mb-2 flex-row items-center justify-between">
      <GenieText
        variant="caption"
        tone="gold"
        className="font-bold uppercase tracking-widest"
      >
        {title}
      </GenieText>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('client:postCase.review.editA11y', { section: title })}
          className="min-h-touch flex-row items-center gap-1.5 px-1 active:opacity-70"
        >
          <EditIcon size={15} color={colors.gold} />
          <GenieText variant="body-sm" tone="gold">
            {t('client:postCase.review.edit')}
          </GenieText>
        </Pressable>
      ) : null}
    </View>

    <View className="rounded-card bg-surface px-4 py-2">
      {children}
    </View>
  </View>
  );
};

const Row: React.FC<{
  label: string;
  value?: string | null;
  needsCheck?: boolean;
  last?: boolean;
}> = ({ label, value, needsCheck = false, last = false }) => {
  if (!value) {
    return null;
  }

  return (
    <View className={last ? 'py-3' : 'py-3 mb-1'}>
      <View className="mb-1 flex-row items-center gap-2">
        <GenieText variant="caption" tone="muted">
          {label}
        </GenieText>
        {needsCheck ? <CheckBadge /> : null}
      </View>
      <GenieText variant="body-md">{value}</GenieText>
    </View>
  );
};

const SelectedLawyerCard: React.FC<{
  lawyer: RecommendedLawyer;
  onViewProfile: () => void;
}> = ({ lawyer, onViewProfile }) => {
  const { t } = useT();
  const photo = resolveFileUrl(lawyer.profileImage);

  return (
    <View className="py-3">
      <View className="flex-row">
        <View className="mr-3">
          {photo ? (
            <Image
              source={{ uri: photo }}
              className="h-20 w-16 rounded-control bg-surface-alt"
              resizeMode="cover"
              accessibilityLabel={t('client:postCase.lawyers.photoA11y', { name: lawyer.fullName })}
            />
          ) : (
            <View className="h-20 w-16 items-center justify-center rounded-control bg-surface-alt">
              <ScalesIcon size={24} color={colors.textMuted} />
            </View>
          )}

          {lawyer.onlineStatus ? (
            <View className="mt-1 flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full bg-success" />
              <GenieText
                variant="caption"
                tone="success"
                className="text-small-label"
              >
                {t('client:postCase.lawyers.online')}
              </GenieText>
            </View>
          ) : null}
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <GenieText variant="heading-sm" numberOfLines={1} className="flex-1">
              {lawyer.fullName}
            </GenieText>
            {lawyer.verified ? (
              <VerifiedBadge size={15} />
            ) : null}
          </View>

          {lawyer.specialization ? (
            <GenieText variant="body-sm" tone="gold" className="mt-0.5">
              {practiceAreaLabel(lawyer.specialization)}
            </GenieText>
          ) : null}

          {lawyer.location ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <LocationIcon size={13} color={colors.textMuted} />
              <GenieText
                variant="body-sm"
                tone="secondary"
                numberOfLines={1}
                className="flex-1"
              >
                {lawyer.location}
              </GenieText>
            </View>
          ) : null}

          {lawyer.rating > 0 ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <StarIcon size={13} color={colors.gold} />
              <GenieText variant="body-sm">{lawyer.rating.toFixed(1)}</GenieText>
              <GenieText variant="body-sm" tone="muted">
                {t('client:postCase.lawyers.reviews', { count: lawyer.reviewCount })}
              </GenieText>
            </View>
          ) : null}

          {lawyer.experience > 0 || lawyer.casesHandled > 0 ? (
            <GenieText variant="body-sm" tone="secondary" className="mt-1">
              {[
                lawyer.experience > 0
                  ? t('client:postCase.lawyers.yearsExp', { count: lawyer.experience })
                  : '',
                lawyer.casesHandled > 0
                  ? t('client:postCase.lawyers.casesCount', { count: lawyer.casesHandled })
                  : '',
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </GenieText>
          ) : null}

          <GenieText
            variant="body-sm"
            tone="success"
            className="mt-1 font-semibold"
          >
            {t('client:postCase.lawyers.match', { percent: lawyer.matchPercentage })}
          </GenieText>

          {lawyer.responseTime ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <ClockIcon size={13} color={colors.textMuted} />
              <GenieText variant="body-sm" tone="muted" numberOfLines={1}>
                {lawyer.responseTime}
              </GenieText>
            </View>
          ) : null}
        </View>
      </View>

      {lawyer.languages?.length ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {lawyer.languages.map(language => (
            <View
              key={language}
              className="rounded-pill bg-card px-3 py-1"
            >
              <GenieText variant="caption" tone="secondary">
                {displayLabel('common:languageNames', language)}
              </GenieText>
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-3">
        <GenieButton
          label={t('client:postCase.review.viewFullProfile')}
          variant="outline"
          size="sm"
          onPress={onViewProfile}
        />
      </View>

      <GenieText variant="caption" tone="muted" className="mt-3">
        {t('client:postCase.review.notifiedNote')}
      </GenieText>
    </View>
  );
};

export const ReviewStep: React.FC<ReviewStepProps> = ({
  state,
  onEditStep,
  onViewLawyerProfile,
  submitError,
  hasAgreed,
  onAgreedChange,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const { t } = useT();
  const check = new Set(state.aiNeedsReview);

  const title =
    state.title.trim() || subTypeLabel(state.subcategory.trim()) || categoryLabel(state.category.trim());

  const categoryLine = state.subcategory
    ? `${categoryLabel(state.category)} - ${subTypeLabel(state.subcategory)}`
    : categoryLabel(state.category);

  const documents = documentsToSubmit(state);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-6 pt-5"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <GenieText variant="heading-lg">{t('client:postCase.review.title')}</GenieText>
      <GenieText variant="body-sm" tone="secondary" className="mt-1">
        {t('client:postCase.review.subtitle')}
      </GenieText>

      {state.aiSessionId ? (
        <View className="mt-4 flex-row items-center gap-2 rounded-card bg-gold-muted px-3 py-2.5">
          <SparkleIcon size={16} color={colors.gold} />
          <View className="flex-1">
            <GenieText variant="body-sm" tone="gold" className="font-bold">
              {t('client:postCase.review.aiExtracted')}
            </GenieText>
            <GenieText variant="caption" tone="secondary" className="mt-0.5">
              {t('client:postCase.review.aiExtractedNote')}
            </GenieText>
          </View>
        </View>
      ) : null}

      {check.size > 0 ? (
        <GenieNotice
          tone="warning"
          className="mt-3"
          message={
            check.size === 1
              ? t('client:postCase.review.oneLowConfidence')
              : t('client:postCase.review.manyLowConfidence', { count: check.size })
          }
        />
      ) : null}

      {state.aiWarnings.length > 0 ? (
        <GenieNotice
          tone="warning"
          className="mt-3"
          message={state.aiWarnings.join('\n')}
        />
      ) : null}

      <Section title={t('client:postCase.review.case')} onEdit={() => onEditStep(1)}>
        <Row label={t('client:postCase.review.caseTitle')} value={title} />
        <Row
          label={t('client:postCase.review.category')}
          value={categoryLine}
          needsCheck={check.has('category') || check.has('subType')}
        />
        <Row label={t('client:postCase.review.description')} value={state.description} />
        <Row
          label={t('client:postCase.review.location')}
          value={state.location}
          needsCheck={check.has('city')}
        />
        <Row label={t('client:postCase.review.state')} value={state.state} />
        <Row
          label={t('client:postCase.review.preferredCourt')}
          value={state.preferredCourt}
          needsCheck={check.has('court')}
        />
        <Row
          label={t('client:postCase.review.urgency')}
          value={displayLabel('cases:urgency', state.urgency)}
          needsCheck={check.has('urgency')}
          last
        />
      </Section>

      {state.incidentDate ||
      state.opposingParty ||
      state.firNumber ||
      state.policeStation ||
      state.bailDetails ||
      state.claimAmount ? (
        <Section title={t('client:postCase.review.furtherDetail')}>
          <Row
            label={t('client:postCase.review.incidentDate')}
            value={formatDate(state.incidentDate)}
            needsCheck={check.has('incidentDate')}
          />
          <Row
            label={t('client:postCase.review.otherParty')}
            value={state.opposingParty}
            needsCheck={check.has('opposingParty')}
          />
          <Row
            label={t('client:postCase.review.claimAmount')}
            value={
              typeof state.claimAmount === 'number'
                ? String(state.claimAmount)
                : ''
            }
          />
          <Row label={t('client:postCase.review.firNumber')} value={state.firNumber} />
          <Row label={t('client:postCase.review.policeStation')} value={state.policeStation} />
          <Row label={t('client:postCase.review.bailDetails')} value={state.bailDetails} last />
        </Section>
      ) : null}

      {state.aiSummary ? (
        <Section title={t('client:postCase.review.understood')}>
          <View className="py-3">
            <GenieText variant="body-sm" tone="secondary">
              {state.aiSummary}
            </GenieText>
            <GenieText variant="caption" tone="muted" className="mt-2">
              {t('client:postCase.review.referenceOnly')}
            </GenieText>
          </View>
        </Section>
      ) : null}

      {state.voiceTranscript ? (
        <Section title={t('client:postCase.review.voiceNote')}>
          <View className="py-3">
            <GenieText variant="body-sm" tone="secondary">
              {state.voiceTranscript}
            </GenieText>
            <GenieText variant="caption" tone="muted" className="mt-2">
              {t('client:postCase.review.voiceNoteNote')}
            </GenieText>
          </View>
        </Section>
      ) : null}

      {state.aiParties.length > 0 ? (
        <Section title={t('client:postCase.review.partiesNamed')}>
          {state.aiParties.map((party, index) => (
            <View
              key={`${party.name}-${index}`}
              className={
                index === state.aiParties.length - 1
                  ? 'py-3'
                  : 'py-3 mb-1'
              }
            >
              <GenieText variant="body-md">{party.name}</GenieText>
              {party.role ? (
                <GenieText variant="caption" tone="muted" className="mt-0.5">
                  {party.role}
                </GenieText>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}

      <Section
        title={t('client:postCase.review.supportingDocuments', { count: documents.length })}
        onEdit={() => onEditStep(2)}
      >
        <GenieText variant="body-sm" tone="secondary" className="pt-3">
          {t('client:postCase.review.docsReady', { count: documents.length })}
        </GenieText>
        {documents.map(document => (
          <View
            key={document.id}
            testID="review-pending-document"
            className="flex-row items-center gap-3 py-3"
          >
            <FileIcon size={20} color={colors.gold} />
            <View className="flex-1">
              <GenieText variant="body-md" numberOfLines={1}>
                {document.name}
              </GenieText>
              <GenieText variant="caption" tone="muted">
                {t('client:postCase.review.sizeReady', { size: formatFileSize(document.size) })}
              </GenieText>
            </View>
          </View>
        ))}
      </Section>

      <Section
        title={t('client:postCase.review.yourLawyers', {
          selected: state.selectedLawyers.length,
          count: REQUIRED_LAWYER_COUNT,
        })}
        onEdit={() => onEditStep(3)}
      >
        {state.selectedLawyers.length === 0 ? (
          <View className="py-3">
            <GenieText variant="body-md" tone="secondary">
              {t('client:postCase.review.noLawyers')}
            </GenieText>
          </View>
        ) : (
          <>
            <GenieText variant="body-sm" tone="secondary" className="pt-3">
              {t('client:postCase.review.goesToAll', { count: REQUIRED_LAWYER_COUNT })}
            </GenieText>
            {state.selectedLawyers.map(lawyer => (
              <SelectedLawyerCard
                key={lawyer.userId}
                lawyer={lawyer}
                onViewProfile={() =>
                  onViewLawyerProfile(lawyer.userId, lawyer.fullName)
                }
              />
            ))}
          </>
        )}
      </Section>

      <Pressable
        onPress={() => onAgreedChange(!hasAgreed)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasAgreed }}
        accessibilityLabel={t('client:postCase.review.agreeA11y')}
        className="mt-5 flex-row items-start gap-3 rounded-card bg-surface p-4 active:opacity-80"
      >
        <View
          className={`mt-0.5 h-6 w-6 items-center justify-center rounded-control border-2 ${
            hasAgreed ? 'border-border bg-gold' : 'border-border'
          }`}
        >
          {hasAgreed ? <CheckIcon size={15} color={colors.background} /> : null}
        </View>

        <View className="flex-1">
          <GenieText variant="body-sm" tone="secondary">
            {t('client:postCase.review.agreeBefore')}
            <GenieText
              variant="body-sm"
              tone="gold"
              className="font-semibold underline"
              onPress={onOpenTerms}
            >
              {t('client:postCase.review.terms')}
            </GenieText>
            {t('client:postCase.review.agreeMiddle')}
            <GenieText
              variant="body-sm"
              tone="gold"
              className="font-semibold underline"
              onPress={onOpenPrivacy}
            >
              {t('client:postCase.review.privacy')}
            </GenieText>
            {t('client:postCase.review.agreeAfter')}
          </GenieText>
        </View>
      </Pressable>

      {submitError ? (
        <GenieNotice tone="error" className="mt-4" message={submitError} />
      ) : null}
    </ScrollView>
  );
};
