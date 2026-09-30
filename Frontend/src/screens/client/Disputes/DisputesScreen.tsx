import React, { useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieFilterTabs,
  GenieHeader,
  GenieNotice,
  GenieRefreshControl,
  GenieSkeletonList,
  GenieStatusBadge,
  GenieText,
} from '../../../components';
import { GenieCard } from '../../../components/ui/GenieCard';
import { issuesApi } from '../../../api/issuesApi';
import { toAppError } from '../../../utils/errors';
import type { Issue } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { formatDate } from '../../../utils/format';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

type Tab = 'all' | 'pending' | 'assigned' | 'resolved';

const TABS: ReadonlyArray<Tab> = ['all', 'pending', 'assigned', 'resolved'];

const ISSUE_CATEGORIES = [
  'Consultation Issue',
  'Payment Issue',
  'Lawyer Behavior',
  'Case Issue',
  'Document Issue',
  'Technical Issue',
  'Refund Request',
  'Other',
];

export const DisputesScreen: React.FC<ClientStackScreenProps<'Disputes'>> = ({ navigation }) => {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: issues, isLoading, error, refetch } = useQuery({
    queryKey: ['issues'],
    queryFn: issuesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string; category: string }) =>
      issuesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setShowForm(false);
      setTitle('');
      setDescription('');
      setCategory(ISSUE_CATEGORIES[0]);
      setFormError(null);
    },
    onError: (err) => setFormError(toAppError(err).message),
  });

  const filtered = useMemo(() => {
    if (!issues) return [];
    if (tab === 'all') return issues;
    return issues.filter((i) => i.status.toLowerCase() === tab);
  }, [issues, tab]);

  const renderItem = ({ item }: { item: Issue }) => (
    <GenieCard className="mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <GenieText variant="body" className="font-semibold">
            {item.title}
          </GenieText>
          <GenieText variant="caption" tone="muted">
            {displayLabel('client:disputes.categories', item.category)}
          </GenieText>
        </View>
        <GenieStatusBadge status={item.status} />
      </View>
      <GenieText variant="body-sm" className="mt-2" numberOfLines={2}>
        {item.description}
      </GenieText>
      <GenieText variant="caption" tone="muted" className="mt-2">
        {formatDate(item.createdAt)}
      </GenieText>
    </GenieCard>
  );

  if (showForm) {
    return (
      <View className="flex-1 bg-background">
        <GenieHeader title={t('client:disputes.fileTitle')} onBack={() => { setShowForm(false); setFormError(null); }} />
        <View className="px-4 pt-4">
          <GenieText variant="label" className="mb-2">{t('client:disputes.title')}</GenieText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('client:disputes.titlePlaceholder')}
            maxLength={200}
            className="rounded-control border border-border bg-card px-4 py-3 text-body-md text-white mb-4"
            placeholderTextColor={colors.textMuted}
          />
          <GenieText variant="label" className="mb-2">{t('client:disputes.description')}</GenieText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('client:disputes.descriptionPlaceholder')}
            multiline
            textAlignVertical="top"
            numberOfLines={4}
            className="rounded-control border border-border bg-card px-4 py-3 text-body-md text-white mb-4"
            placeholderTextColor={colors.textMuted}
          />
          {formError && <GenieNotice tone="error" message={formError} className="mb-3" />}
          <GenieButton
            label={t('client:disputes.submit')}
            loading={createMutation.isPending}
            disabled={!title.trim() || !description.trim()}
            onPress={() => createMutation.mutate({ title: title.trim(), description: description.trim(), category })}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <GenieHeader
        title={t('client:disputes.heading')}
        onBack={() => navigation.goBack()}
        right={
          <GenieButton label={t('client:disputes.new')} onPress={() => setShowForm(true)} variant="secondary" size="sm" />
        }
      />
      <View className="px-4 pt-2">
        <GenieFilterTabs
          tabs={TABS.map(key => ({ key, label: t(`client:disputes.tabs.${key}`) }))}
          value={tab}
          onChange={setTab}
        />
      </View>
      {isLoading ? (
        <GenieSkeletonList count={4} />
      ) : error ? (
        <GenieErrorState
          title={t('client:disputes.loadFailed')}
          message={toAppError(error).message}
          onRetry={() => refetch()}
        />
      ) : filtered.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={<GenieRefreshControl onRefresh={() => refetch()} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      ) : (
        <GenieEmptyState
          title={t('client:disputes.empty')}
          description={t('client:disputes.emptyHint')}
        />
      )}
    </View>
  );
};
