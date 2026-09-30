import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  GenieBottomSheet,
  GenieButton,
  GenieChip,
  GenieText,
} from '../ui';
import { StarIcon } from '../icons/ClientIcons';
import { getLegalCategories } from '../../services/legalCategories';
import { colors } from '../../theme';
import { advocatesApi } from '../../api/advocatesApi';
import type { AdvocateFilters, ExperienceBucket } from '../../api/advocatesApi';
import { useT } from '../../i18n/useT';
import { categoryLabel, displayLabel } from '../../i18n/labels';

export interface AdvocateFilterModalProps {
  visible: boolean;
  filters: AdvocateFilters;
  onClose: () => void;
  onApply: (filters: AdvocateFilters) => void;
  onReset: () => void;
}

// Sentinel for the "all locations" chip; never sent to the API.
const ALL_LOCATIONS = '__all__';

const useAdvocateLocations = (enabled: boolean): string[] => {
  const query = useQuery({
    queryKey: ['advocates', {}],
    queryFn: () => advocatesApi.list({}),
    enabled,
  });

  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const advocate of query.data ?? []) {
      const raw = advocate.user?.location?.trim();
      if (raw && !seen.has(raw.toLowerCase())) {
        seen.set(raw.toLowerCase(), raw);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [query.data]);
};

const EXPERIENCE_OPTIONS: Array<{ label: string; value?: ExperienceBucket }> = [
  { label: 'All Experience', value: undefined },
  { label: '0-2 Years', value: '0-2' },
  { label: '3-5 Years', value: '3-5' },
  { label: '5-10 Years', value: '5-10' },
  { label: '10+ Years', value: '10+' },
];

const RATING_OPTIONS: Array<{ label: string; value?: string }> = [
  { label: 'All Ratings', value: undefined },
  { label: '4 & up', value: '4★+' },
  { label: '3 & up', value: '3★+' },
  { label: '2 & up', value: '2★+' },
  { label: '1 & up', value: '1★+' },
];

const FEE_RANGES: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Any Fee', min: undefined, max: undefined },
  { label: 'Under ₹1000', min: 0, max: 1000 },
  { label: '₹1000 - ₹2500', min: 1000, max: 2500 },
  { label: '₹2500 - ₹5000', min: 2500, max: 5000 },
  { label: '₹5000+', min: 5000, max: undefined },
];

const Group: React.FC<{
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}> = ({ label, children, trailing }) => (
  <View className="mb-5">
    <View className="mb-2 flex-row items-center justify-between">
      <GenieText variant="label">{label}</GenieText>
      {trailing}
    </View>
    {children}
  </View>
);

export const AdvocateFilterModal: React.FC<AdvocateFilterModalProps> = ({
  visible,
  filters,
  onClose,
  onApply,
  onReset,
}) => {
  const { t } = useT();
  const optionLabel = (label: string) => displayLabel('client:advocateFilters.options', label);
  const [specialization, setSpecialization] = useState<string | undefined>(
    filters.specialization,
  );
  const [location, setLocation] = useState<string | undefined>(filters.location);
  const knownLocations = useAdvocateLocations(visible);
  const locations =
    location && !knownLocations.includes(location)
      ? [location, ...knownLocations]
      : knownLocations;
  const [experience, setExperience] = useState<ExperienceBucket | undefined>(
    filters.experience,
  );
  const [rating, setRating] = useState<string | undefined>(filters.rating);
  const [feeIndex, setFeeIndex] = useState(0);

  const handleApply = () => {
    const selectedFee = FEE_RANGES[feeIndex];
    onApply({
      ...filters,
      specialization,
      location,
      experience,
      rating,
      minFee: selectedFee?.min,
      maxFee: selectedFee?.max,
    });
    onClose();
  };

  const handleReset = () => {
    setSpecialization(undefined);
    setLocation(undefined);
    setExperience(undefined);
    setRating(undefined);
    setFeeIndex(0);
    onReset();
    onClose();
  };

  return (
    <GenieBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('client:advocateFilters.title')}
      footer={
        <View className="flex-row gap-3">
          <GenieButton
            label={t('client:advocateFilters.reset')}
            variant="outline"
            onPress={handleReset}
            className="flex-1"
          />
          <GenieButton
            label={t('client:advocateFilters.apply')}
            onPress={handleApply}
            className="flex-1"
          />
        </View>
      }
    >
      <ScrollView
        className="max-h-[420px]"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Group label={t('client:advocateFilters.practiceArea')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-2"
          >
            <GenieChip
              label={t('client:advocateFilters.allPracticeAreas')}
              selected={!specialization}
              onPress={() => setSpecialization(undefined)}
            />
            {getLegalCategories().map(cat => (
              <GenieChip
                key={cat.id}
                label={categoryLabel(cat.id)}
                selected={specialization === cat.title}
                onPress={() =>
                  setSpecialization(
                    specialization === cat.title ? undefined : cat.title,
                  )
                }
              />
            ))}
          </ScrollView>
        </Group>

        <Group label={t('client:advocateFilters.location')}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-2"
          >
            {[ALL_LOCATIONS, ...locations].map(loc => {
              const isAll = loc === ALL_LOCATIONS;
              return (
                <GenieChip
                  key={loc}
                  label={isAll ? t('client:advocateFilters.allLocations') : loc}
                  selected={isAll ? !location : location === loc}
                  onPress={() => setLocation(isAll ? undefined : loc)}
                />
              );
            })}
          </ScrollView>
        </Group>

        <Group label={t('client:advocateFilters.experience')}>
          <View className="flex-row flex-wrap gap-2">
            {EXPERIENCE_OPTIONS.map(exp => (
              <GenieChip
                key={exp.label}
                label={optionLabel(exp.label)}
                selected={experience === exp.value}
                onPress={() => setExperience(exp.value)}
              />
            ))}
          </View>
        </Group>

        <Group label={t('client:advocateFilters.rating')}>
          <View className="flex-row flex-wrap gap-2">
            {RATING_OPTIONS.map(option => {
              const isSelected = option.value
                ? rating === option.value
                : !rating;
              return (
                <GenieChip
                  key={option.label}
                  label={optionLabel(option.label)}
                  selected={isSelected}
                  icon={
                    option.value ? (
                      <StarIcon
                        size={13}
                        color={isSelected ? colors.gold : colors.textSecondary}
                      />
                    ) : undefined
                  }
                  onPress={() => setRating(option.value)}
                />
              );
            })}
          </View>
        </Group>

        <Group
          label={t('client:advocateFilters.consultationFee')}
          trailing={
            <GenieText variant="body-sm" tone="gold" className="font-semibold">
              {optionLabel(FEE_RANGES[feeIndex]?.label ?? FEE_RANGES[0].label)}
            </GenieText>
          }
        >
          <View className="flex-row flex-wrap gap-2">
            {FEE_RANGES.map((fee, idx) => (
              <GenieChip
                key={fee.label}
                label={optionLabel(fee.label)}
                selected={feeIndex === idx}
                onPress={() => setFeeIndex(idx)}
              />
            ))}
          </View>
        </Group>
      </ScrollView>
    </GenieBottomSheet>
  );
};
