import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { GenieText } from '../ui';
import { useT } from '../../i18n/useT';
import { displayLabel } from '../../i18n/labels';

export type DocumentFilterType = 'All' | 'PDF' | 'DOCX' | 'Images' | 'TXT';

const FILTER_TYPES: DocumentFilterType[] = ['All', 'PDF', 'DOCX', 'Images', 'TXT'];

export interface DocumentFilterChipsProps {
  selectedFilter: DocumentFilterType;
  onSelectFilter: (filter: DocumentFilterType) => void;
}

export const DocumentFilterChips: React.FC<DocumentFilterChipsProps> = ({
  selectedFilter,
  onSelectFilter,
}) => {
  useT(); // re-render on language change
  return (
    <View className="py-2.5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 gap-2 flex-row items-center"
      >
        {FILTER_TYPES.map(filter => {
          const isSelected = selectedFilter === filter;
          return (
            <Pressable
              key={filter}
              onPress={() => onSelectFilter(filter)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`h-9 items-center justify-center rounded-pill px-4 ${
                isSelected
                  ? 'bg-gold'
                  : 'border border-border bg-surface active:bg-surface-secondary'
              }`}
            >
              <GenieText
                variant="body-sm"
                tone={isSelected ? 'on-gold' : 'secondary'}
                className={isSelected ? 'font-bold' : 'font-medium'}
              >
                {displayLabel('documents:filters', filter)}
              </GenieText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};
