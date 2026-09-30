import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieButton,
  GenieNotice,
  GenieStatusBadge,
  GenieText,
  ProfileImageViewer,
} from '../../../components';
import {
  ChevronRightIcon,
  ClockIcon,
  CourtIcon,
  LocationIcon,
  ScalesIcon,
} from '../../../components/icons/ClientIcons';
import { MailIcon, PhoneIcon } from '../../../components/icons/Icons';
import {
  CalendarIcon,
  CheckCircleIcon,
} from '../../../components/icons/LawyerIcons';
import { casesApi } from '../../../api/casesApi';
import { chatApi } from '../../../api/chatApi';
import { lawyerApi } from '../../../api/lawyerApi';
import { toAppError } from '../../../utils/errors';
import { formatDate } from '../../../utils/format';
import type { LegalCase } from '../../../types/domain';
import type { LawyerClientDetail } from '../../../types/lawyer';
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
import { categoryLabel, displayLabel, subTypeLabel } from '../../../i18n/labels';

const retryServerErrors = (count: number, error: unknown) => {
  const status = toAppError(error).status;
  return count < 2 && (status === undefined || status >= 500);
};

export const LawyerClientDetailsScreen: React.FC<
  LawyerStackScreenProps<'LawyerClientDetails'>
> = ({ navigation, route }) => {
  const { t } = useT();
  const { clientId, caseId } = route.params;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const clientQuery = useQuery({
    queryKey: ['lawyer', 'client', clientId],
    queryFn: () => lawyerApi.getClientDetails(clientId),
    retry: retryServerErrors,
  });

  const caseQuery = useQuery({
    queryKey: ['lawyer', 'case', caseId],
    queryFn: () => casesApi.getById(caseId),
    retry: retryServerErrors,
  });

  const startMutation = useMutation({
    mutationFn: () => lawyerApi.startCase(caseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lawyer', 'clients'] });
      await caseQuery.refetch();
    },
    onError: error => setActionError(toAppError(error).message),
  });

  const chatMutation = useMutation({
    mutationFn: () => chatApi.getOrCreateChat(clientId),
    onSuccess: chat => {
      const client = clientQuery.data?.client;
      navigation.navigate('Chat', {
        chatId: chat._id,
        name: client?.fullName,
        avatar: client?.profileImage,
      });
    },
    onError: error => setActionError(toAppError(error).message),
  });

  const caseItem = caseQuery.data;
  const detail = clientQuery.data;
  const caseClientId = clientOf(caseItem?.client)?._id ?? null;
  const mismatch = Boolean(caseItem && caseClientId && String(caseClientId) !== clientId);

  const refresh = () => Promise.all([clientQuery.refetch(), caseQuery.refetch()]);

  return (
    <DetailScaffold
      title={t('lawyer:clientDetails.title')}
      onBack={() => navigation.goBack()}
      isPending={clientQuery.isPending || caseQuery.isPending}
      error={
        caseQuery.isError
          ? caseQuery.error
          : clientQuery.isError
          ? clientQuery.error
          : mismatch
          ? new Error(t('lawyer:clientDetails.mismatch'))
          : null
      }
      onRefresh={refresh}
    >
      {detail && caseItem ? (
        <ClientBody
          detail={detail}
          caseItem={caseItem}
          actionError={actionError}
          starting={startMutation.isPending}
          openingChat={chatMutation.isPending}
          onStart={() => {
            setActionError(null);
            startMutation.mutate();
          }}
          onChat={() => {
            setActionError(null);
            chatMutation.mutate();
          }}
          onOpenCase={otherCaseId =>
            navigation.replace('LawyerClientDetails', { clientId, caseId: otherCaseId })
          }
        />
      ) : null}
    </DetailScaffold>
  );
};

interface ClientBodyProps {
  detail: LawyerClientDetail;
  caseItem: LegalCase;
  actionError: string | null;
  starting: boolean;
  openingChat: boolean;
  onStart: () => void;
  onChat: () => void;
  onOpenCase: (caseId: string) => void;
}

const ClientBody: React.FC<ClientBodyProps> = ({
  detail,
  caseItem,
  actionError,
  starting,
  openingChat,
  onStart,
  onChat,
  onOpenCase,
}) => {
  const { t } = useT();
  const client = detail.client;
  const name = client?.fullName || t('lawyer:clientDetails.client');
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const category = [categoryLabel(caseItem.category), subTypeLabel(caseItem.subcategory)]
    .filter(Boolean)
    .join(' · ');
  const milestones = caseItem.milestones ?? [];
  const hearings = caseItem.hearings ?? [];
  const otherCases = (detail.caseHistory ?? []).filter(
    other => other && String(other._id) !== String(caseItem._id),
  );

  return (
    <View testID="client-details">
      <DetailSection title={t('lawyer:clientDetails.clientInfo')}>
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => setIsPhotoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('lawyer:clientDetails.viewPhotoA11y', { name })}
          >
            <GenieAvatar uri={client?.profileImage} name={name} size="lg" />
          </Pressable>
          <View className="flex-1">
            <GenieText variant="heading-sm" numberOfLines={2} testID="client-details-name">
              {name}
            </GenieText>
            <GenieText variant="caption" tone="muted" className="mt-0.5">
              {t('lawyer:clientDetails.clientId', { id: shortId(client?._id) })}
            </GenieText>
          </View>
        </View>
        {client?.mobile ? (
          <DetailRow
            label={t('lawyer:clientDetails.phone')}
            value={client.mobile}
            icon={<PhoneIcon size={15} color={colors.gold} />}
          />
        ) : null}
        {client?.email ? (
          <DetailRow
            label={t('lawyer:clientDetails.email')}
            value={client.email}
            icon={<MailIcon size={15} color={colors.gold} />}
          />
        ) : null}
        {client?.location ? (
          <DetailRow
            label={t('lawyer:clientDetails.clientLocation')}
            value={client.location}
            icon={<LocationIcon size={15} color={colors.gold} />}
          />
        ) : null}
      </DetailSection>

      <DetailSection title={t('lawyer:clientDetails.caseInfo')}>
        <GenieText variant="heading-sm" testID="client-details-case-title">
          {caseItem.title || t('lawyer:clientDetails.untitled')}
        </GenieText>
        <View className="mb-3 mt-2 flex-row flex-wrap items-center gap-2">
          <GenieStatusBadge status={caseItem.status} />
        </View>
        <DetailRow
          label={t('lawyer:clientDetails.category')}
          value={category}
          icon={<ScalesIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:clientDetails.urgency')}
          value={displayLabel('cases:urgency', caseItem.urgency)}
          icon={<ClockIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:clientDetails.acceptedOn')}
          value={formatDate(caseItem.acceptedAt)}
          icon={<CalendarIcon size={15} color={colors.gold} />}
        />
        {caseItem.startedAt ? (
          <DetailRow label={t('lawyer:clientDetails.startedOn')} value={formatDate(caseItem.startedAt)} />
        ) : null}
        {caseItem.completedAt ? (
          <DetailRow label={t('lawyer:clientDetails.completedOn')} value={formatDate(caseItem.completedAt)} />
        ) : null}
      </DetailSection>

      <DetailSection title={t('lawyer:clientDetails.description')}>
        <GenieText variant="body-sm" tone={caseItem.description ? 'secondary' : 'muted'}>
          {caseItem.description || t('lawyer:clientDetails.noDescription')}
        </GenieText>
      </DetailSection>

      <DetailSection title={t('lawyer:clientDetails.locationCourt')}>
        <DetailRow
          label={t('lawyer:clientDetails.location')}
          value={caseItem.location || caseItem.locationCity}
          icon={<LocationIcon size={15} color={colors.gold} />}
        />
        <DetailRow
          label={t('lawyer:clientDetails.preferredCourt')}
          value={caseItem.preferredCourt}
          icon={<CourtIcon size={15} color={colors.gold} />}
        />
        {caseItem.nextHearing ? (
          <DetailRow label={t('lawyer:clientDetails.nextHearing')} value={formatDate(caseItem.nextHearing)} />
        ) : null}
      </DetailSection>

      <CaseDocumentsSection documents={caseItem.documents} />

      <DetailSection title={t('lawyer:clientDetails.timeline')} testID="client-details-timeline">
        {milestones.length === 0 && hearings.length === 0 ? (
          <GenieText variant="body-sm" tone="muted">
            {t('lawyer:clientDetails.noTimeline')}
          </GenieText>
        ) : null}
        {milestones.map((milestone, index) => (
          <View
            key={milestone._id ?? `${milestone.title}-${index}`}
            className="mb-2 flex-row items-center gap-2"
          >
            <CheckCircleIcon
              size={16}
              color={milestone.isCompleted ? colors.gold : colors.textMuted}
            />
            <GenieText
              variant="body-sm"
              tone={milestone.isCompleted ? 'primary' : 'muted'}
              className="flex-1"
            >
              {milestone.title}
            </GenieText>
            {milestone.isCompleted && milestone.date ? (
              <GenieText variant="caption" tone="muted">
                {formatDate(milestone.date)}
              </GenieText>
            ) : null}
          </View>
        ))}
        {hearings.map(hearing => (
          <View key={hearing._id} className="mb-2 flex-row items-start gap-2">
            <View className="mt-0.5">
              <CourtIcon size={16} color={colors.gold} />
            </View>
            <View className="flex-1">
              <GenieText variant="body-sm">
                {t('lawyer:clientDetails.hearingOn', { date: formatDate(hearing.date) })}
                {hearing.timeSlot ? `, ${hearing.timeSlot}` : ''}
              </GenieText>
              {hearing.court || hearing.purpose ? (
                <GenieText variant="caption" tone="secondary">
                  {[hearing.court, hearing.purpose].filter(Boolean).join(' - ')}
                </GenieText>
              ) : null}
            </View>
            {hearing.status ? (
              <GenieText variant="caption" tone="muted">
                {displayLabel('cases:status', hearing.status)}
              </GenieText>
            ) : null}
          </View>
        ))}
      </DetailSection>

      {otherCases.length > 0 ? (
        <DetailSection title={t('lawyer:clientDetails.otherCases', { name })}>
          {otherCases.map((other, index) => (
            <Pressable
              key={other._id}
              accessibilityRole="button"
              onPress={() => onOpenCase(String(other._id))}
              className={`min-h-touch flex-row items-center gap-2 py-2 active:bg-surface-alt ${
                index > 0 ? 'mt-2' : ''
              }`}
            >
              <View className="flex-1">
                <GenieText variant="body-sm" numberOfLines={2}>
                  {other.title || t('lawyer:clientDetails.untitled')}
                </GenieText>
                <GenieText variant="caption" tone="muted">
                  {displayLabel('cases:status', other.status)}
                </GenieText>
              </View>
              <ChevronRightIcon size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </DetailSection>
      ) : null}

      {actionError ? <GenieNotice message={actionError} className="mt-4" /> : null}

      <View className="mt-5 gap-3">
        {caseItem.status === 'Accepted' ? (
          <GenieButton
            testID="client-details-start"
            label={t('lawyer:clientDetails.startCase')}
            loading={starting}
            loadingLabel={t('lawyer:clientDetails.starting')}
            onPress={onStart}
            fullWidth
          />
        ) : null}
        <GenieButton
          testID="client-details-chat"
          label={t('lawyer:clientDetails.chat')}
          variant="outline"
          loading={openingChat}
          onPress={onChat}
          fullWidth
        />
      </View>

      <ProfileImageViewer
        visible={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        imageUri={client?.profileImage}
        name={name}
      />
    </View>
  );
};
