import React, { useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Linking,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import { GenieButton, GenieNotice, GenieText } from '../../../components';
import { ChevronRightIcon } from '../../../components/icons/ClientIcons';
import { ChevronDownIcon } from '../../../components/icons/Icons';
import type { RelevantCase, RelevantCasesState } from '../../../types/lawyer';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

const VerificationBadge: React.FC<{ status: RelevantCase['verificationStatus'] }> = ({
  status,
}) => {
  useT(); // re-render on language change
  const official = status === 'Source Retrieved';
  return (
    <View
      className={`self-start rounded-pill border px-2.5 py-0.5 ${
        official ? 'border-border bg-gold-muted' : 'border-warning bg-warning-surface'
      }`}
    >
      <GenieText variant="caption" tone={official ? 'gold' : 'warning'} className="font-bold">
        {displayLabel('lawyer:relevantCases.verification', status)}
      </GenieText>
    </View>
  );
};

const RelevantCaseCard: React.FC<{ item: RelevantCase }> = ({ item }) => {
  const { t } = useT();
  return (
  <View className="mb-3 rounded-control border border-border bg-surface p-3">
    <VerificationBadge status={item.verificationStatus} />
    <GenieText variant="body-md" className="mt-2 font-bold">
      {item.caseTitle}
    </GenieText>
    <GenieText variant="caption" tone={item.citation ? 'secondary' : 'muted'} className="mt-0.5">
      {item.citation
        ? t('lawyer:relevantCases.citationVerify', { citation: item.citation })
        : t('lawyer:relevantCases.noCitation')}
    </GenieText>
    {item.court || item.jurisdiction || item.decisionDate ? (
      <GenieText variant="caption" tone="secondary" className="mt-0.5">
        {[item.court, item.jurisdiction, item.decisionDate].filter(Boolean).join(' · ')}
      </GenieText>
    ) : null}
    {item.relevanceSummary ? (
      <GenieText variant="body-sm" tone="secondary" className="mt-2 leading-5">
        {item.relevanceSummary}
      </GenieText>
    ) : null}
    {item.legalPrinciple ? (
      <GenieText variant="body-sm" tone="secondary" className="mt-2 leading-5">
        {t('lawyer:relevantCases.principle', { principle: item.legalPrinciple })}
      </GenieText>
    ) : null}
    {item.sources.map(source => (
      <Pressable
        key={source.url}
        onPress={() => void Linking.openURL(source.url)}
        accessibilityRole="link"
        accessibilityLabel={t('lawyer:relevantCases.openSourceA11y', {
          name: source.name || t('lawyer:relevantCases.theWeb'),
        })}
        className="mt-2 min-h-touch justify-center active:opacity-70"
      >
        <GenieText variant="body-sm" tone="gold" className="font-bold">
          {t('lawyer:relevantCases.openSource', { name: source.name || t('lawyer:relevantCases.web') })}
        </GenieText>
      </Pressable>
    ))}
  </View>
  );
};

export const RelevantCasesSection: React.FC<{
  state: RelevantCasesState | undefined;
  canSearch: boolean;
  isStarting: boolean;
  onSearch: (input: { query?: string; jurisdiction?: string }) => void;
}> = ({ state, canSearch, isStarting, onSearch }) => {
  const { t } = useT();
  const status = state?.status ?? 'idle';
  const [isOpen, setIsOpen] = useState(status !== 'idle');
  const [query, setQuery] = useState('');
  const [jurisdiction, setJurisdiction] = useState(state?.jurisdiction ?? '');
  const searching = status === 'searching' || isStarting;
  const results = state?.results ?? [];

  const run = () =>
    onSearch({
      query: query.trim() || undefined,
      jurisdiction: jurisdiction.trim() || undefined,
    });

  return (
    <View
      testID="relevant-cases-section"
      className="mb-3 overflow-hidden rounded-card border border-border bg-card"
    >
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsOpen(open => !open);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={t('lawyer:relevantCases.title')}
        className="min-h-touch flex-row items-center gap-3 px-4 py-3.5 active:opacity-80"
      >
        <GenieText variant="body-lg" tone="gold" className="flex-1 font-bold">
          {t('lawyer:relevantCases.title')}
        </GenieText>
        {status === 'completed' && results.length > 0 ? (
          <GenieText variant="caption" tone="muted">
            {t('lawyer:relevantCases.found', { count: results.length })}
          </GenieText>
        ) : null}
        {isOpen ? (
          <ChevronDownIcon size={18} color={colors.textSecondary} />
        ) : (
          <ChevronRightIcon size={18} color={colors.textSecondary} />
        )}
      </Pressable>

      {isOpen ? (
        <View className="px-4 pb-4">
          <View className="mb-3 rounded-control border border-warning bg-warning-surface px-3 py-2">
            <GenieText variant="caption" tone="warning" className="leading-4">
              {t('lawyer:relevantCases.warning')}
            </GenieText>
          </View>

          {searching ? (
            <View testID="relevant-cases-searching" className="mb-3 flex-row items-center gap-3">
              <ActivityIndicator size="small" color={colors.gold} />
              <GenieText variant="body-sm" tone="secondary">
                {t('lawyer:relevantCases.searching')}
              </GenieText>
            </View>
          ) : null}

          {!searching && (status === 'failed' || status === 'unavailable') ? (
            <GenieNotice
              tone="error"
              message={state?.message || t('lawyer:relevantCases.searchFailed')}
              className="mb-3"
            />
          ) : null}

          {!searching && status === 'completed' && results.length === 0 ? (
            <GenieText variant="body-sm" tone="secondary" className="mb-3">
              {state?.message || t('lawyer:relevantCases.noneFound')}
            </GenieText>
          ) : null}

          {!searching
            ? results.map(item => (
                <RelevantCaseCard key={`${item.caseTitle}-${item.citation}`} item={item} />
              ))
            : null}

          {!searching && status !== 'unavailable' ? (
            <View className="gap-2">
              <View className="rounded-control border border-border bg-surface px-3 py-2">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('lawyer:relevantCases.refinePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  className="min-h-[24px] text-body-sm text-white"
                  accessibilityLabel={t('lawyer:relevantCases.refineA11y')}
                />
              </View>
              <View className="rounded-control border border-border bg-surface px-3 py-2">
                <TextInput
                  value={jurisdiction}
                  onChangeText={setJurisdiction}
                  placeholder={t('lawyer:relevantCases.jurisdictionPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  className="min-h-[24px] text-body-sm text-white"
                  accessibilityLabel={t('lawyer:relevantCases.jurisdictionA11y')}
                />
              </View>
              <GenieButton
                testID="relevant-cases-search"
                label={
                  status === 'idle'
                    ? t('lawyer:relevantCases.search')
                    : status === 'failed'
                    ? t('lawyer:relevantCases.retry')
                    : t('lawyer:relevantCases.searchAgain')
                }
                variant={status === 'idle' ? 'primary' : 'outline'}
                size="sm"
                disabled={!canSearch}
                onPress={run}
              />
              {!canSearch ? (
                <GenieText variant="caption" tone="muted" className="text-center">
                  {t('lawyer:relevantCases.availableLater')}
                </GenieText>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};
