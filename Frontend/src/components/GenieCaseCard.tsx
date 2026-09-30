import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { GenieAvatar, GenieText } from './ui';
import { getCategoryIcon } from './icons/CategoryIcons';
import {
  CalendarIcon,
  ChatIcon,
  ChevronRightIcon,
  LocationIcon,
  StarIcon,
} from './icons/ClientIcons';
import { AlertIcon, CheckIcon } from './icons/Icons';
import {
  PROGRESS_STEPS,
  getAssignedLawyerData,
  getCaseProgressStep,
  getStatusBadgeTheme,
} from '../utils/caseUtils';
import { formatDate } from '../utils/format';
import { getUploadUrl } from '../utils/urls';
import type { LegalCase } from '../types/domain';
import { colors } from '../theme';
import { useT } from '../i18n/useT';
import { categoryLabel, displayLabel, practiceAreaLabel } from '../i18n/labels';

export interface GenieCaseCardProps {
  item: LegalCase;
  onPress: (id: string) => void;
  onMessageLawyer?: (lawyerId: string, lawyerName: string) => void;
}

// Inline tracker: completed steps get a gold check, the current step a gold
// dot, the rest stay gray. No box of its own inside the card.
const Tracker: React.FC<{ currentStep: number; isRejected: boolean }> = ({
  currentStep,
  isRejected,
}) => (
  <View className="flex-row">
    {PROGRESS_STEPS.map((step, idx) => {
      const complete = !isRejected && step.index < currentStep;
      const current = !isRejected && step.index === currentStep;
      const rejectedHere = isRejected && step.index === currentStep;
      const reached = !isRejected && step.index <= currentStep;

      return (
        <View key={step.index} className="flex-1 items-center">
          <View className="w-full flex-row items-center">
            <View
              className={`h-0.5 flex-1 ${
                idx === 0 ? 'bg-transparent' : reached ? 'bg-gold' : 'bg-border'
              }`}
            />
            {complete ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-gold">
                <CheckIcon size={12} color={colors.onGold} />
              </View>
            ) : current ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-gold">
                <GenieText variant="caption" tone="on-gold" className="text-small-label font-bold">
                  {String(step.index)}
                </GenieText>
              </View>
            ) : rejectedHere ? (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-error-surface">
                <AlertIcon size={11} color={colors.error} />
              </View>
            ) : (
              <View className="h-5 w-5 items-center justify-center rounded-full bg-surface-secondary">
                <GenieText variant="caption" tone="muted" className="text-small-label">
                  {String(step.index)}
                </GenieText>
              </View>
            )}
            <View
              className={`h-0.5 flex-1 ${
                idx === PROGRESS_STEPS.length - 1
                  ? 'bg-transparent'
                  : !isRejected && step.index < currentStep
                  ? 'bg-gold'
                  : 'bg-border'
              }`}
            />
          </View>
          <GenieText
            variant="caption"
            tone={current ? 'gold' : rejectedHere ? 'error' : complete ? 'primary' : 'muted'}
            className="mt-1 text-small-label"
            numberOfLines={1}
          >
            {displayLabel('cases:progress', step.title)}
          </GenieText>
        </View>
      );
    })}
  </View>
);

// Memoized: list rows re-render only when their own props change, not on
// every parent update (e.g. a background refetch of the list).
export const GenieCaseCard = memo<GenieCaseCardProps>(({
  item,
  onPress,
  onMessageLawyer,
}) => {
  const { t } = useT();
  const { currentStep, isRejected } = getCaseProgressStep(item.status, item);
  const badge = getStatusBadgeTheme(item.status);
  const lawyer = getAssignedLawyerData(item);
  const CategoryIcon = getCategoryIcon(item.category);
  const shortId = `#${item._id.slice(-6).toUpperCase()}`;
  const location = item.locationCity || item.locationDistrict || item.location || '';
  const open = () => onPress(item._id);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t('cases:card.a11y', {
        title: item.title,
        status: displayLabel('cases:status', item.status),
      })}
      className="mb-3 rounded-card bg-card p-4 active:bg-surface-secondary"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-shrink flex-row items-center gap-1.5 rounded-full bg-surface-secondary px-2.5 py-1">
          <CategoryIcon size={12} color={colors.gold} />
          <GenieText variant="caption" tone="secondary" className="font-medium" numberOfLines={1}>
            {categoryLabel(item.category) || t('cases:card.legalCase')}
          </GenieText>
        </View>

        <View
          className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${badge.bg}`}
        >
          <View className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          <GenieText variant="caption" tone={badge.tone} className="font-semibold" numberOfLines={1}>
            {displayLabel('cases:status', item.status)}
          </GenieText>
        </View>
      </View>

      <View className="mt-3 flex-row items-start gap-2">
        <GenieText variant="cardTitle" className="flex-1" numberOfLines={2}>
          {item.title}
        </GenieText>
        <View className="mt-0.5">
          <ChevronRightIcon size={16} color={colors.textMuted} />
        </View>
      </View>

      <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        {location ? (
          <View className="flex-row items-center gap-1">
            <LocationIcon size={12} color={colors.textMuted} />
            <GenieText variant="caption" tone="secondary">
              {location}
            </GenieText>
          </View>
        ) : null}
        <View className="flex-row items-center gap-1">
          <CalendarIcon size={12} color={colors.textMuted} />
          <GenieText variant="caption" tone="secondary">
            {formatDate(item.createdAt)}
          </GenieText>
        </View>
        <GenieText variant="caption" tone="muted" selectable>
          {shortId}
        </GenieText>
      </View>

      <View className="mt-4">
        <Tracker currentStep={currentStep} isRejected={isRejected} />
      </View>

      {item.nextHearing ? (
        <View className="mt-3 flex-row items-center gap-1.5">
          <CalendarIcon size={13} color={colors.gold} />
          <GenieText variant="caption" tone="secondary">
            Next hearing:{' '}
            <GenieText variant="caption" className="font-semibold text-white">
              {formatDate(item.nextHearing)}
            </GenieText>
          </GenieText>
        </View>
      ) : null}

      {lawyer ? (
        <View className="mt-4 flex-row items-center gap-3">
          <GenieAvatar
            uri={getUploadUrl(lawyer.profileImage)}
            name={lawyer.fullName}
            size="card"
          />
          <View className="flex-1">
            <GenieText variant="body" className="font-semibold" numberOfLines={1}>
              {t('common:advocate.advName', { name: lawyer.fullName })}
            </GenieText>
            {lawyer.specialization ? (
              <GenieText variant="caption" tone="secondary" numberOfLines={1}>
                {practiceAreaLabel(lawyer.specialization)}
              </GenieText>
            ) : null}
          </View>
          {lawyer.rating !== null && lawyer.totalReviews > 0 ? (
            <View className="flex-row items-center gap-1">
              <StarIcon size={12} color={colors.gold} />
              <GenieText variant="caption" className="font-semibold text-white" selectable>
                {lawyer.rating.toFixed(1)}
              </GenieText>
              <GenieText variant="caption" tone="muted" selectable>
                ({lawyer.totalReviews})
              </GenieText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={t('cases:card.viewDetails')}
          className="h-11 flex-1 flex-row items-center justify-center gap-1 rounded-control bg-surface-secondary active:bg-border"
        >
          <GenieText variant="button" className="font-medium text-white">
            {t('cases:card.viewCase')}
          </GenieText>
          <ChevronRightIcon size={14} color={colors.white} />
        </Pressable>

        {lawyer && onMessageLawyer ? (
          <Pressable
            onPress={() => onMessageLawyer(lawyer.id, lawyer.fullName)}
            accessibilityRole="button"
            accessibilityLabel={t('cases:card.messageLawyer', { name: lawyer.fullName })}
            className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-control bg-gold active:bg-gold-pressed"
          >
            <ChatIcon size={15} color={colors.onGold} />
            <GenieText variant="button" tone="on-gold">
              {t('cases:card.message')}
            </GenieText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
});

(GenieCaseCard as React.NamedExoticComponent).displayName = 'GenieCaseCard';
