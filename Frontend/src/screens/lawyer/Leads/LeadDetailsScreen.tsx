import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieButton,
  GenieNotice,
  GenieStatusBadge,
  GenieText,
} from '../../../components';
import {
  ClockIcon,
  CourtIcon,
  FileIcon,
  LocationIcon,
  ScalesIcon,
} from '../../../components/icons/ClientIcons';
import { CalendarIcon } from '../../../components/icons/LawyerIcons';
import { casesApi } from '../../../api/casesApi';
import { lawyerApi } from '../../../api/lawyerApi';
import { useAuthStore } from '../../../store/authStore';
import { toAppError } from '../../../utils/errors';
import { formatDate, formatDateTime } from '../../../utils/format';
import type { LegalCase } from '../../../types/domain';
import type { LawyerLead } from '../../../types/lawyer';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import {
  CaseDocumentsSection,
  DetailRow,
  DetailSection,
  clientOf,
  shortId,
} from '../shared/CaseDetailParts';
import { DetailScaffold } from '../shared/DetailScaffold';
import { useT } from '../../../i18n/useT';
import i18n from '../../../i18n';
import { categoryLabel, displayLabel, subTypeLabel } from '../../../i18n/labels';

const OPEN_STATUSES = [
  'Submitted',
  'Awaiting Lawyer Acceptance',
  'Pending Lawyer Response',
  'Interested',
];

const idOf = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return String((value as { _id?: string })._id ?? '') || null;
  }
  return String(value);
};

type RequestView =
  | { kind: 'open' }
  | { kind: 'mine' }
  | { kind: 'closed'; message: string };

const requestView = (item: LegalCase, myId: string | null): RequestView => {
  const assigned = idOf(item.assignedLawyer);
  if (assigned && myId && assigned === myId) {
    return { kind: 'mine' };
  }
  if (assigned) {
    return { kind: 'closed', message: i18n.t('lawyer:leadDetails.takenByOther') };
  }
  const mine = item.myRequestStatus;
  if (mine === 'Pending' || (!mine && OPEN_STATUSES.includes(item.status))) {
    return { kind: 'open' };
  }
  if (mine === 'Declined') {
    return { kind: 'closed', message: i18n.t('lawyer:leadDetails.youDeclined') };
  }
  return { kind: 'closed', message: i18n.t('lawyer:leadDetails.noLongerAvailable') };
};

export const LeadDetailsScreen: React.FC<LawyerStackScreenProps<'LeadDetails'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const { caseId } = route.params;
  const queryClient = useQueryClient();
  const myId = useAuthStore(state => state.user?.id ?? null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justAccepted, setJustAccepted] = useState(false);

  const caseQuery = useQuery({
    queryKey: ['lawyer', 'lead', caseId],
    queryFn: () => casesApi.getById(caseId),
    retry: (count, error) => {
      const status = toAppError(error).status;
      return count < 2 && (status === undefined || status >= 500);
    },
  });

  // The list already fetched this lead; reuse its match score instead of refetching.
  const listed = queryClient
    .getQueryData<LawyerLead[]>(['lawyer', 'leads'])
    ?.find(lead => String(lead.caseId) === caseId);

  const refreshLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lawyer', 'leads'] }),
      queryClient.invalidateQueries({ queryKey: ['lawyer', 'clients'] }),
      queryClient.invalidateQueries({ queryKey: ['chats'] }),
    ]);
  };

  const acceptMutation = useMutation({
    mutationFn: () => lawyerApi.acceptLead(caseId),
    onSuccess: async () => {
      setJustAccepted(true);
      await refreshLists();
      await caseQuery.refetch();
    },
    onError: async error => {
      setActionError(toAppError(error).message);
      await refreshLists();
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => lawyerApi.rejectLead(caseId),
    onSuccess: async () => {
      await refreshLists();
      navigation.goBack();
    },
    onError: async error => {
      setActionError(toAppError(error).message);
      await refreshLists();
    },
  });

  const item = caseQuery.data;
  const busy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <DetailScaffold
      title={t('lawyer:leadDetails.title')}
      onBack={() => navigation.goBack()}
      isPending={caseQuery.isPending}
      error={caseQuery.isError ? caseQuery.error : null}
      onRefresh={() => caseQuery.refetch()}
    >
      {item ? (
        <LeadBody
          item={item}
          view={requestView(item, myId)}
          matchPercentage={listed?.matchPercentage ?? null}
          busy={busy}
          accepting={acceptMutation.isPending}
          declining={declineMutation.isPending}
          actionError={actionError}
          justAccepted={justAccepted}
          onAccept={() => {
            setActionError(null);
            acceptMutation.mutate();
          }}
          onDecline={() => {
            setActionError(null);
            declineMutation.mutate();
          }}
          onViewClient={clientId =>
            navigation.navigate('LawyerClientDetails', { clientId, caseId: item._id })
          }
        />
      ) : null}
    </DetailScaffold>
  );
};

interface LeadBodyProps {
  item: LegalCase;
  view: RequestView;
  matchPercentage: number | null;
  busy: boolean;
  accepting: boolean;
  declining: boolean;
  actionError: string | null;
  justAccepted: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onViewClient: (clientId: string) => void;
}

const LeadBody: React.FC<LeadBodyProps> = ({
  item,
  view,
  matchPercentage,
  busy,
  accepting,
  declining,
  actionError,
  justAccepted,
  onAccept,
  onDecline,
  onViewClient,
}) => {
  const { t } = useT();
  const client = clientOf(item.client);
  const clientName = client?.fullName || t('lawyer:leadDetails.client');
  const documents = item.documents ?? [];
  const myRequest = item.lawyerRequests?.[0];
  const receivedAt = myRequest?.createdAt || item.createdAt;
  const category = [categoryLabel(item.category), subTypeLabel(item.subcategory)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View testID="lead-details">
      <View className="flex-row items-center gap-3 rounded-card bg-surface p-4">
        <GenieAvatar uri={client?.profileImage} name={clientName} size="lg" />
        <View className="flex-1">
          <GenieText variant="heading-sm" numberOfLines={2} testID="lead-client-name">
            {clientName}
          </GenieText>
          {client?._id ? (
            <GenieText variant="caption" tone="muted" className="mt-0.5">
              {t('lawyer:leadDetails.clientId', { id: shortId(client._id) })}
            </GenieText>
          ) : null}
        </View>
        {matchPercentage !== null && matchPercentage !== undefined ? (
          <View className="rounded-md border border-success bg-success-surface px-2 py-1">
            <GenieText variant="caption" tone="success" className="font-bold">
              {t('lawyer:leadDetails.match', { percent: matchPercentage })}
            </GenieText>
          </View>
        ) : null}
      </View>

      <GenieText variant="heading-lg" className="mt-5" testID="lead-case-title">
        {item.title || t('lawyer:leadDetails.untitled')}
      </GenieText>
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <GenieStatusBadge status={item.status} />
        <GenieText variant="caption" tone="muted">
          {t('lawyer:leadDetails.posted', { date: formatDate(item.createdAt) })}
        </GenieText>
      </View>

      <DetailSection title={t('lawyer:leadDetails.caseInfo')}>
        <DetailRow
          label={t('lawyer:leadDetails.category')}
          value={category}
          icon={<ScalesIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:leadDetails.urgency')}
          value={displayLabel('cases:urgency', item.urgency)}
          icon={<ClockIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:leadDetails.postedOn')}
          value={formatDate(item.createdAt)}
          icon={<CalendarIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:leadDetails.documents')}
          value={t('lawyer:leadDetails.documentsCount', { count: documents.length })}
          icon={<FileIcon size={15} color={colors.gold} />}
        />
      </DetailSection>

      <DetailSection title={t('lawyer:leadDetails.description')}>
        <GenieText
          variant="body-sm"
          tone={item.description ? 'secondary' : 'muted'}
          testID="lead-description"
        >
          {item.description || t('lawyer:leadDetails.noDescription')}
        </GenieText>
      </DetailSection>

      <DetailSection title={t('lawyer:leadDetails.locationCourt')}>
        <DetailRow
          label={t('lawyer:leadDetails.location')}
          value={item.location || item.locationCity}
          icon={<LocationIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:leadDetails.preferredCourt')}
          value={item.preferredCourt}
          icon={<CourtIcon size={15} color={colors.gold} />}
        />
      </DetailSection>

      <CaseDocumentsSection documents={documents} />

      <DetailSection title={t('lawyer:leadDetails.requestStatus')} testID="lead-request-status">
        <DetailRow label={t('lawyer:leadDetails.received')} value={formatDateTime(receivedAt)} />
        <DetailRow
          label={t('lawyer:leadDetails.yourRequest')}
          value={
            view.kind === 'mine'
              ? t('lawyer:leadDetails.acceptedByYou')
              : item.myRequestStatus
              ? displayLabel('cases:status', item.myRequestStatus)
              : view.kind === 'open'
              ? t('lawyer:leadDetails.pending')
              : ''
          }
        />
        {view.kind === 'open' ? (
          <GenieText variant="body-sm" tone="secondary">
            {t('lawyer:leadDetails.firstTakes')}
          </GenieText>
        ) : null}
        {view.kind === 'closed' ? (
          <GenieNotice tone="warning" message={view.message} />
        ) : null}
        {view.kind === 'mine' ? (
          <GenieNotice
            tone="success"
            message={
              justAccepted
                ? t('lawyer:leadDetails.justAccepted')
                : t('lawyer:leadDetails.youAccepted')
            }
          />
        ) : null}
      </DetailSection>

      {actionError ? (
        <GenieNotice message={actionError} className="mt-4" />
      ) : null}

      {view.kind === 'open' ? (
        <View className="mt-5 flex-row gap-3" testID="lead-actions">
          <View className="flex-1">
            <GenieButton
              testID="lead-details-decline"
              label={t('lawyer:leadDetails.decline')}
              variant="outline"
              loading={declining}
              loadingLabel={t('lawyer:leadDetails.declining')}
              disabled={busy}
              onPress={onDecline}
              fullWidth
            />
          </View>
          <View className="flex-1">
            <GenieButton
              testID="lead-details-accept"
              label={t('lawyer:leadDetails.accept')}
              loading={accepting}
              loadingLabel={t('lawyer:leadDetails.accepting')}
              disabled={busy}
              onPress={onAccept}
              fullWidth
            />
          </View>
        </View>
      ) : null}

      {view.kind === 'mine' && client?._id ? (
        <GenieButton
          testID="lead-details-view-client"
          label={t('lawyer:leadDetails.viewClient')}
          className="mt-5"
          onPress={() => onViewClient(client._id)}
          fullWidth
        />
      ) : null}
    </View>
  );
};
