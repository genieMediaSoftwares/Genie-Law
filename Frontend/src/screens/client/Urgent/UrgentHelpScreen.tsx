import React, { useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieButton,
  GenieCard,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieRefreshControl,
  GenieSkeletonList,
  GenieStatusBadge,
  GenieText,
} from '../../../components';
import { ClockIcon } from '../../../components/icons/ClientIcons';
import { casesApi } from '../../../api/casesApi';
import { toAppError } from '../../../utils/errors';
import type { LegalCase } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { formatDate } from '../../../utils/format';
import { useT } from '../../../i18n/useT';
import { categoryLabel, displayLabel } from '../../../i18n/labels';

const URGENCY_REASONS = [
  'Arrest / Police matter',
  'Bail',
  'Domestic violence',
  'Immediate court deadline',
  'Cybercrime',
  'Property emergency',
  'Other',
];

export const UrgentHelpScreen: React.FC<ClientStackScreenProps<'UrgentHelp'>> = ({ navigation }) => {
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgencyReason, setUrgencyReason] = useState(URGENCY_REASONS[0]);
  const [location, setLocation] = useState('');

  // The client's own cases marked Urgent. Errors reach the error state below.
  const { data: urgentCases, isLoading, error, refetch } = useQuery({
    queryKey: ['cases', 'urgent'],
    queryFn: async () => (await casesApi.list()).filter(item => item.urgency === 'Urgent'),
  });

  // A case needs its lawyers chosen before it can be filed, so the details
  // typed here continue in Post Your Case, marked Urgent.
  const continueToPostCase = () => {
    navigation.navigate('PostCase', {
      start: 'manual',
      prefill: {
        title: title.trim() || displayLabel('client:urgent.reasons', urgencyReason),
        description: description.trim(),
        location: location.trim(),
        urgency: 'Urgent',
      },
    });
  };

  const renderCaseItem = ({ item }: { item: LegalCase }) => (
    <GenieCard className="mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <GenieText variant="body" className="font-semibold">
            {item.title}
          </GenieText>
          <GenieText variant="caption" tone="muted">
            {categoryLabel(item.category)}
          </GenieText>
        </View>
        <GenieStatusBadge status={item.status} />
      </View>
      <GenieText variant="caption" tone="muted" className="mt-2">
        {t('client:urgent.filed', { date: formatDate(item.createdAt) })}
      </GenieText>
    </GenieCard>
  );

  const renderSubmitForm = () => (
    <View className="px-4 pt-4">
      <GenieText variant="label" className="mb-2">{t('client:urgent.reason')}</GenieText>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {URGENCY_REASONS.map((reason) => (
          <GenieButton
            key={reason}
            label={displayLabel('client:urgent.reasons', reason)}
            variant={urgencyReason === reason ? 'primary' : 'outline'}
            size="sm"
            onPress={() => setUrgencyReason(reason)}
          />
        ))}
      </View>
      <GenieText variant="label" className="mb-2">{t('client:urgent.briefTitle')}</GenieText>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('client:urgent.briefTitlePlaceholder')}
        className="rounded-control bg-card px-4 py-3 text-body-md text-white mb-4"
        placeholderTextColor={colors.textMuted}
      />
      <GenieText variant="label" className="mb-2">{t('client:urgent.description')}</GenieText>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t('client:urgent.descriptionPlaceholder')}
        multiline
        textAlignVertical="top"
        numberOfLines={5}
        className="rounded-control bg-card px-4 py-3 text-body-md text-white mb-4"
        placeholderTextColor={colors.textMuted}
      />
      <GenieText variant="label" className="mb-2">{t('client:urgent.location')}</GenieText>
      <TextInput
        value={location}
        onChangeText={setLocation}
        placeholder={t('client:urgent.locationPlaceholder')}
        className="rounded-control bg-card px-4 py-3 text-body-md text-white mb-4"
        placeholderTextColor={colors.textMuted}
      />
      <GenieButton
        label={t('client:urgent.submit')}
        disabled={!description.trim()}
        onPress={continueToPostCase}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <GenieHeader title={t('client:urgent.title')} onBack={() => navigation.goBack()} />
      {isLoading ? (
        <GenieSkeletonList count={4} />
      ) : error ? (
        <GenieErrorState
          title={t('client:urgent.loadFailed')}
          message={toAppError(error).message}
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          ListHeaderComponent={renderSubmitForm()}
          data={urgentCases ?? []}
          keyExtractor={(item) => item._id}
          renderItem={renderCaseItem}
          ListEmptyComponent={
            <View className="px-4 pt-4">
              <GenieEmptyState
                icon={<ClockIcon size={48} color={colors.textMuted} />}
                title={t('client:urgent.empty')}
                description={t('client:urgent.emptyHint')}
              />
            </View>
          }
          refreshControl={<GenieRefreshControl onRefresh={() => refetch()} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
};
