import React, { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieNotice,
  GenieSkeletonList,
  GenieText,
  VerifiedBadge,
} from '../../../../components';
import {
  LocationIcon,
  ClockIcon,
  ScalesIcon,
  StarIcon,
} from '../../../../components/icons/ClientIcons';
import { CheckIcon } from '../../../../components/icons/Icons';
import { advocatesApi } from '../../../../api/advocatesApi';
import { resolveFileUrl } from '../../../../utils/urls';
import type { RecommendedLawyer } from '../../../../types/domain';
import { REQUIRED_LAWYER_COUNT, toggleLawyer } from '../types';
import type { PostCaseState } from '../types';
import { colors } from '../../../../theme';
import { useT } from '../../../../i18n/useT';
import { categoryLabel, displayLabel, practiceAreaLabel, subTypeLabel } from '../../../../i18n/labels';

const SORT_OPTIONS = [
  'Best Match',
  'Experience',
  'Rating',
  'Fees: Low to High',
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

interface LawyersStepProps {
  state: PostCaseState;
  onChange: (patch: Partial<PostCaseState>) => void;
  onViewProfile: (userId: string, name: string) => void;
}

const LawyerCard: React.FC<{
  lawyer: RecommendedLawyer;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onViewProfile: () => void;
}> = ({ lawyer, isSelected, isLocked, onSelect, onViewProfile }) => {
  const { t } = useT();
  const photo = resolveFileUrl(lawyer.profileImage);

  return (
    <Pressable
      testID={`lawyer-card-${lawyer.userId}`}
      onPress={onSelect}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isLocked }}
      accessibilityLabel={`${
        isSelected
          ? t('client:postCase.lawyers.deselectA11y', { name: lawyer.fullName })
          : t('client:postCase.lawyers.selectA11y', { name: lawyer.fullName })
      }${lawyer.specialization ? `, ${practiceAreaLabel(lawyer.specialization)}` : ''}`}
      className={`mb-3 rounded-card border p-4 active:opacity-90 ${
        isSelected ? 'border-2 border-border bg-gold-muted' : 'border border-border bg-card'
      } ${isLocked ? 'opacity-50' : ''}`}
    >
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
              <GenieText variant="caption" tone="success" className="text-small-label">
                {t('client:postCase.lawyers.online')}
              </GenieText>
            </View>
          ) : null}
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 flex-row items-center gap-1.5 pr-2">
              <GenieText variant="heading-sm" numberOfLines={1}>
                {lawyer.fullName}
              </GenieText>
              {lawyer.verified ? (
                <VerifiedBadge size={15} />
              ) : null}
            </View>

            <View
              className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                isSelected ? 'border-border bg-gold' : 'border-border'
              }`}
            >
              {isSelected ? (
                <CheckIcon size={13} color={colors.background} />
              ) : null}
            </View>
          </View>

          {lawyer.specialization ? (
            <GenieText variant="body-sm" tone="gold" className="mt-0.5">
              {practiceAreaLabel(lawyer.specialization)}
            </GenieText>
          ) : null}

          {lawyer.location ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <LocationIcon size={13} color={colors.textMuted} />
              <GenieText variant="body-sm" tone="secondary" numberOfLines={1} className="flex-1">
                {lawyer.location}
              </GenieText>
            </View>
          ) : null}

          {lawyer.rating > 0 ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <StarIcon size={13} color={colors.gold} />
              <GenieText variant="body-sm">
                {lawyer.rating.toFixed(1)}
              </GenieText>
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

          <GenieText variant="body-sm" tone="success" className="mt-1 font-semibold">
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
              className="rounded-pill border border-border bg-card px-3 py-1"
            >
              <GenieText variant="caption" tone="secondary">
                {displayLabel('common:languageNames', language)}
              </GenieText>
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-3 flex-row gap-3">
        <GenieButton
          label={t('client:postCase.lawyers.viewProfile')}
          variant="outline"
          size="sm"
          onPress={onViewProfile}
          className="flex-1"
        />
        <GenieButton
          label={
            isSelected
              ? t('client:postCase.lawyers.selected')
              : isLocked
              ? t('client:postCase.lawyers.limitReached')
              : t('client:postCase.lawyers.selectLawyer')
          }
          variant={isSelected ? 'primary' : 'outline'}
          size="sm"
          onPress={onSelect}
          disabled={isLocked}
          className="flex-1"
        />
      </View>
    </Pressable>
  );
};

export const LawyersStep: React.FC<LawyersStepProps> = ({
  state,
  onChange,
  onViewProfile,
}) => {
  const { t } = useT();
  const matter = subTypeLabel(state.subcategory) || categoryLabel(state.category);
  const [sortBy, setSortBy] = useState<SortOption>('Best Match');

  const recommendationQuery = useQuery({
    queryKey: [
      'lawyers',
      'recommend',
      state.category,
      state.subcategory,
      state.location,
      state.state,
      sortBy,
    ],
    queryFn: () =>
      advocatesApi.recommend({
        category: state.category,
        ...(state.subcategory ? { subcategory: state.subcategory } : {}),
        ...(state.location ? { city: state.location } : {}),
        ...(state.state ? { state: state.state } : {}),
        sortBy,
        limit: '20',
      }),
    enabled: Boolean(state.category),
  });

  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);

  const lawyers = recommendationQuery.data ?? [];
  const selectedCount = state.selectedLawyers.length;
  const isFull = selectedCount >= REQUIRED_LAWYER_COUNT;
  const remaining = REQUIRED_LAWYER_COUNT - selectedCount;

  const select = (lawyer: RecommendedLawyer) => {
    const outcome = toggleLawyer(state.selectedLawyers, lawyer);
    setSelectionMessage(outcome.ok ? null : outcome.reason);
    if (outcome.ok) {
      onChange({ selectedLawyers: outcome.selected });
    }
  };

  const isSelected = (lawyer: RecommendedLawyer) =>
    state.selectedLawyers.some(item => item.userId === lawyer.userId);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-6 pt-5"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center justify-between">
        <GenieText variant="heading-lg">{t('client:postCase.lawyers.title', { count: REQUIRED_LAWYER_COUNT })}</GenieText>
        <View
          testID="lawyer-selection-counter"
          accessibilityLiveRegion="polite"
          className={`rounded-pill border px-3 py-1 ${
            isFull ? 'border-border bg-gold' : 'border-border bg-surface'
          }`}
        >
          <GenieText
            variant="body-sm"
            tone={isFull ? 'on-gold' : 'gold'}
            className="font-bold"
          >
            {t('client:postCase.lawyers.counter', {
              selected: selectedCount,
              count: REQUIRED_LAWYER_COUNT,
            })}
          </GenieText>
        </View>
      </View>
      <GenieText variant="body-sm" tone="secondary" className="mt-1">
        {state.location
          ? t('client:postCase.lawyers.matchedIn', { matter, location: state.location })
          : t('client:postCase.lawyers.matched', { matter })}
      </GenieText>
      <GenieText variant="body-sm" tone="muted" className="mt-1">
        {t('client:postCase.lawyers.goesToAll', { count: REQUIRED_LAWYER_COUNT })}
      </GenieText>

      {selectionMessage ? (
        <View className="mt-3">
          <GenieNotice tone="warning" message={selectionMessage} />
        </View>
      ) : !isFull ? (
        <GenieText testID="lawyer-selection-hint" variant="body-sm" tone="gold" className="mt-3">
          {t('client:postCase.lawyers.selectMore', { count: remaining })}
        </GenieText>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mt-4"
        contentContainerClassName="px-5 gap-2"
      >
        {SORT_OPTIONS.map(option => {
          const active = sortBy === option;
          return (
            <Pressable
              key={option}
              onPress={() => setSortBy(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`min-h-touch justify-center rounded-pill border px-4 ${
                active
                  ? 'border-border bg-gold'
                  : 'border border-border bg-surface active:opacity-80'
              }`}
            >
              <View className="flex-row items-center gap-1.5">
                {option === 'Best Match' ? (
                  <StarIcon
                    size={14}
                    color={active ? colors.background : colors.textSecondary}
                  />
                ) : null}
                <GenieText
                  variant="body-sm"
                  tone={active ? 'on-gold' : 'secondary'}
                  className={active ? 'font-bold' : ''}
                >
                  {displayLabel('client:postCase.lawyers.sort', option)}
                </GenieText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-4">
        {recommendationQuery.isPending ? (
          <GenieSkeletonList count={3} />
        ) : recommendationQuery.isError ? (
          <GenieErrorState
            message={recommendationQuery.error.message}
            onRetry={() => recommendationQuery.refetch()}
          />
        ) : lawyers.length === 0 ? (
          <GenieEmptyState
            icon={<ScalesIcon size={28} color={colors.gold} />}
            title={t('client:postCase.lawyers.noneTitle')}
            description={
              state.location
                ? t('client:postCase.lawyers.noneNear', {
                    category: categoryLabel(state.category),
                    location: state.location,
                  })
                : t('client:postCase.lawyers.none', { category: categoryLabel(state.category) })
            }
          />
        ) : (
          <>
            {lawyers.length < REQUIRED_LAWYER_COUNT ? (
              <View className="mb-3">
                <GenieNotice
                  tone="warning"
                  message={t('client:postCase.lawyers.onlyFew', {
                    count: lawyers.length,
                    required: REQUIRED_LAWYER_COUNT,
                  })}
                />
              </View>
            ) : null}
            {lawyers.map(lawyer => {
              const selected = isSelected(lawyer);
              return (
                <LawyerCard
                  key={lawyer.lawyerId}
                  lawyer={lawyer}
                  isSelected={selected}
                  isLocked={isFull && !selected}
                  onSelect={() => select(lawyer)}
                  onViewProfile={() =>
                    onViewProfile(lawyer.userId, lawyer.fullName)
                  }
                />
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
};
