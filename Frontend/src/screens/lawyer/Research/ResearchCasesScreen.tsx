import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import {
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieSearchInput,
  GenieSkeletonList,
  GenieText,
} from '../../../components';
import {
  ChevronRightIcon,
  ClockIcon,
  FileIcon,
  ScalesIcon,
} from '../../../components/icons/ClientIcons';
import { aiApi } from '../../../api/aiApi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { formatRelative } from '../../../utils/format';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { categoryLabel, displayLabel, subTypeLabel } from '../../../i18n/labels';

export const ResearchCasesScreen: React.FC<
  LawyerStackScreenProps<'ResearchCases'>
> = ({ navigation }) => {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 350);

  const casesQuery = useQuery({
    queryKey: ['lawyer', 'research', 'cases', debounced],
    queryFn: () => aiApi.getResearchCases(debounced || undefined),
  });

  const cases = casesQuery.data ?? [];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('lawyer:researchCases.title')}
        subtitle={t('lawyer:researchCases.subtitle')} onBack={() => navigation.goBack()} />

      <View className="px-4 pb-2 pt-3">
        <GenieSearchInput
          placeholder={t('lawyer:researchCases.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {casesQuery.isPending ? (
        <View className="px-4 pt-2">
          <GenieSkeletonList count={4} />
        </View>
      ) : casesQuery.isError ? (
        <View className="px-4 pt-2">
          <GenieErrorState
            message={casesQuery.error.message}
            onRetry={() => casesQuery.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={cases}
          keyExtractor={item => item.caseId}
          contentContainerClassName="px-4 pb-10 pt-2"
          contentContainerStyle={cases.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <GenieEmptyState
              icon={<ScalesIcon size={28} color={colors.gold} />}
              title={debounced ? t('lawyer:researchCases.noMatches') : t('lawyer:researchCases.none')}
              description={
                debounced
                  ? t('lawyer:researchCases.nothingMatches', { search: debounced })
                  : t('lawyer:researchCases.noneHint')
              }
              actionLabel={debounced ? t('lawyer:researchCases.clearSearch') : undefined}
              onAction={debounced ? () => setSearch('') : undefined}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`research-case-${item.caseId}`}
              onPress={() =>
                navigation.navigate('ResearchDocuments', {
                  caseId: item.caseId,
                  caseTitle: item.title,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:researchCases.researchA11y', { title: item.title })}
              className="mb-3 flex-row items-center gap-3 rounded-card border border-border bg-card p-4 active:opacity-80"
            >
              <View className="flex-1">
                <GenieText variant="body-lg" numberOfLines={1}>
                  {item.title}
                </GenieText>
                <GenieText variant="body-sm" tone="gold" className="mt-0.5" numberOfLines={1}>
                  {[categoryLabel(item.category), subTypeLabel(item.subcategory)].filter(Boolean).join(' · ')}
                </GenieText>
                <GenieText variant="caption" tone="secondary" className="mt-1" numberOfLines={1}>
                  {[item.clientName, item.court, displayLabel('cases:status', item.status)]
                    .filter(Boolean)
                    .join(' · ')}
                </GenieText>
                <View className="mt-1.5 flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1">
                    <FileIcon size={12} color={colors.textMuted} />
                    <GenieText variant="caption" tone="muted">
                      {t('lawyer:researchCases.documents', { count: item.documentCount })}
                    </GenieText>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <ClockIcon size={12} color={colors.textMuted} />
                    <GenieText variant="caption" tone="muted">
                      {t('lawyer:researchCases.updated', { time: formatRelative(item.updatedAt) })}
                    </GenieText>
                  </View>
                </View>
              </View>
              <ChevronRightIcon size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
};
