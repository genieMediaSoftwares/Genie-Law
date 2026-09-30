import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { GenieBottomSheet, GenieButton, GenieText } from '../ui';
import type { SortOption } from '../../api/advocatesApi';
import { useT } from '../../i18n/useT';
import { displayLabel } from '../../i18n/labels';

export interface AdvocateSortModalProps {
  visible: boolean;
  selectedSort?: SortOption | 'Most Relevant';
  onClose: () => void;
  onApply: (sort: SortOption | 'Most Relevant') => void;
}

const SORT_OPTIONS: Array<SortOption | 'Most Relevant'> = [
  'Most Relevant',
  'Highest Rated',
  'Most Reviewed',
  'Name (A - Z)',
  'Name (Z - A)',
  'Newest First',
];

export const AdvocateSortModal: React.FC<AdvocateSortModalProps> = ({
  visible,
  selectedSort = 'Most Relevant',
  onClose,
  onApply,
}) => {
  const { t } = useT();
  const [currentSort, setCurrentSort] = useState<SortOption | 'Most Relevant'>(
    selectedSort,
  );

  const handleApply = () => {
    onApply(currentSort);
    onClose();
  };

  return (
    <GenieBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('client:advocateSort.title')}
      footer={<GenieButton label={t('client:advocateSort.apply')} onPress={handleApply} />}
    >
      <View className="py-1">
        {SORT_OPTIONS.map(option => {
          const isSelected = currentSort === option;

          return (
            <Pressable
              key={option}
              onPress={() => setCurrentSort(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={displayLabel('client:advocateSort.options', option)}
              className="min-h-touch flex-row items-center justify-between rounded-control px-1 active:bg-surface-alt"
            >
              <GenieText
                variant="body-lg"
                tone={isSelected ? 'gold' : 'primary'}
                className={isSelected ? 'font-semibold' : ''}
              >
                {displayLabel('client:advocateSort.options', option)}
              </GenieText>

              <View
                className={[
                  'h-5 w-5 items-center justify-center rounded-full border-2',
                  isSelected ? 'border-border' : 'border-border',
                ].join(' ')}
              >
                {isSelected ? (
                  <View className="h-2.5 w-2.5 rounded-full bg-gold" />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </GenieBottomSheet>
  );
};
