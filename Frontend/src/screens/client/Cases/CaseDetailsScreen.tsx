import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieErrorState,
  GenieHeader,
  GenieProgressStepper,
  GenieScreen,
  GenieSkeleton,
  GenieStatusBadge,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import {
  ClockIcon,
  FileIcon,
  LocationIcon,
} from '../../../components/icons/ClientIcons';
import { casesApi } from '../../../api/casesApi';
import { CASE_STAGES, stageIndexForStatus } from '../../../constants/cases';
import { formatDate, formatDateTime } from '../../../utils/format';
import { formatFileSize } from '../../../utils/urls';
import type { LegalCase, PopulatedUser } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { categoryLabel, displayLabel, subTypeLabel, practiceAreaLabel } from '../../../i18n/labels';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View className="mt-5">
    <GenieText
      variant="caption"
      tone="gold"
      className="mb-2 font-bold uppercase tracking-widest"
    >
      {title}
    </GenieText>
    <View className="rounded-card bg-surface p-4">
      {children}
    </View>
  </View>
);

const Detail: React.FC<{
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => {
  if (!value) {
    return null;
  }

  return (
    <View className="mb-3">
      <GenieText variant="caption" tone="muted">
        {label}
      </GenieText>
      <View className="mt-0.5 flex-row items-center">
        {icon ? <View className="mr-1.5">{icon}</View> : null}
        <GenieText variant="body-sm" className="flex-1">
          {value}
        </GenieText>
      </View>
    </View>
  );
};

const CaseTracker: React.FC<{ item: LegalCase }> = ({ item }) => {
  useT(); // re-render on language change
  const current = stageIndexForStatus(item.status);
  if (current < 0) {
    return null;
  }

  return (
    <GenieProgressStepper
      steps={CASE_STAGES.map(stage => displayLabel('cases:stages', stage))}
      currentIndex={current}
      className="mt-4"
    />
  );
};

const AssignedLawyer: React.FC<{
  item: LegalCase;
  onPress?: (userId: string) => void;
}> = ({ item, onPress }) => {
  const { t } = useT();
  const candidate = item.assignedLawyer ?? item.selectedLawyer;
  const lawyer: PopulatedUser | null =
    candidate && typeof candidate === 'object' ? candidate : null;

  const profile = item.assignedLawyerProfile ?? item.selectedLawyerProfile;

  if (!lawyer) {
    const requests = item.lawyerRequests ?? [];
    return (
      <Section title={t('cases:details.advocate')}>
        <GenieText variant="body-sm" tone="muted">
          {requests.length > 0
            ? t('cases:details.requestSent')
            : t('cases:details.noAdvocate')}
        </GenieText>
        {requests.map((request, index) => {
          const invited =
            typeof request.lawyer === 'object' && request.lawyer ? request.lawyer : null;
          return (
            <View
              key={invited?._id ?? `request-${index}`}
              className="mt-2 flex-row items-center justify-between"
            >
              <GenieText variant="body-md" numberOfLines={1} className="flex-1 pr-2">
                {invited?.fullName ?? t('cases:details.lawyer')}
              </GenieText>
              <GenieText
                variant="body-sm"
                tone={request.status === 'Declined' ? 'muted' : 'gold'}
              >
                {request.status === 'Pending'
                  ? t('cases:details.awaitingResponse')
                  : displayLabel('cases:status', request.status)}
              </GenieText>
            </View>
          );
        })}
      </Section>
    );
  }

  return (
    <Section title={t('cases:details.advocate')}>
      <Pressable
        onPress={() => onPress?.(lawyer._id)}
        disabled={!onPress}
        className="flex-row items-center active:opacity-80"
      >
        <GenieAvatar
          uri={lawyer.profileImage}
          name={lawyer.fullName}
          size="lg"
          ring={Boolean(lawyer.isVerified)}
        />
        <View className="ml-3 flex-1">
          <GenieText variant="body-lg" className="font-bold">
            {lawyer.fullName}
          </GenieText>
          {profile?.specialization ? (
            <GenieText variant="body-sm" tone="gold" className="mt-0.5">
              {practiceAreaLabel(profile.specialization)}
            </GenieText>
          ) : null}
          {profile?.officeAddress ? (
            <GenieText variant="caption" tone="secondary" className="mt-0.5">
              {profile.officeAddress}
            </GenieText>
          ) : null}
        </View>
      </Pressable>
    </Section>
  );
};

export const CaseDetailsScreen: React.FC<
  ClientStackScreenProps<'CaseDetails'>
> = ({ navigation, route }) => {
  const { t } = useT();
  const { caseId } = route.params;

  const caseQuery = useQuery({
    queryKey: ['cases', caseId],
    queryFn: () => casesApi.getById(caseId),
  });

  const item = caseQuery.data;

  const header = (
    <GenieHeader
      title={t('cases:details.title')}
      subtitle={item?.category ? categoryLabel(item.category) : undefined}
      onBack={() => navigation.goBack()}
    />
  );

  if (caseQuery.isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        {header}
        <View className="mt-1 gap-3 px-4">
          <GenieSkeleton className="h-7 w-4/5" />
          <GenieSkeleton className="h-4 w-1/2" />
          <GenieSkeleton className="mt-4 h-24 w-full rounded-card" />
          <GenieSkeleton className="h-36 w-full rounded-card" />
        </View>
      </SafeAreaView>
    );
  }

  if (caseQuery.isError) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        {header}
        <View className="px-4">
          <GenieErrorState
            message={caseQuery.error.message}
            onRetry={() => caseQuery.refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        {header}
      </SafeAreaView>
    );
  }

  return (
    <GenieScreen
      scrollable
      header={header}
      dismissKeyboardOnTap={false}
      contentContainerClassName="pb-10"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={() => caseQuery.refetch()} />
        ),
      }}
    >
      <GenieText variant="heading-lg">{item.title}</GenieText>

      <View className="mt-2 flex-row items-center gap-2">
        <GenieStatusBadge status={item.status} />
        <GenieText variant="caption" tone="muted">
          {t('cases:details.filed', { date: formatDate(item.createdAt) })}
        </GenieText>
      </View>

      <CaseTracker item={item} />

      {item.description ? (
        <Section title={t('cases:details.description')}>
          <GenieText variant="body-sm" tone="secondary">
            {item.description}
          </GenieText>
        </Section>
      ) : null}

      <Section title={t('cases:details.overview')}>
        <Detail label={t('cases:details.category')} value={categoryLabel(item.category)} />
        <Detail label={t('cases:details.subType')} value={subTypeLabel(item.subcategory)} />
        <Detail
          label={t('cases:details.location')}
          value={item.location}
          icon={<LocationIcon size={15} color={colors.gold} />}
        />
        <Detail label={t('cases:details.preferredCourt')} value={item.preferredCourt} />
        <Detail label={t('cases:details.urgency')} value={displayLabel('cases:urgency', item.urgency)} />
        <Detail label={t('cases:details.opposingParty')} value={item.opposingParty} />
        <Detail label={t('cases:details.incidentDate')} value={formatDate(item.incidentDate)} />
        <Detail label={t('cases:details.claimAmount')} value={item.claimAmount} />
        <Detail label={t('cases:details.budgetRange')} value={item.budgetRange} />
        <Detail label={t('cases:details.firNumber')} value={item.firNumber} />
        <Detail label={t('cases:details.policeStation')} value={item.policeStation} />
        <Detail label={t('cases:details.bailDetails')} value={item.bailDetails} />
      </Section>

      {item.voiceTranscript ? (
        <Section title={t('cases:details.voiceTranscript')}>
          <GenieText variant="body-sm" tone="secondary">
            {item.voiceTranscript}
          </GenieText>
        </Section>
      ) : null}

      <AssignedLawyer
        item={item}
        onPress={userId =>
          navigation.navigate('AdvocateProfile', { userId })
        }
      />

      {item.documents?.length ? (
        <Section title={t('cases:details.documentsCount', { count: item.documents.length })}>
          {item.documents.map((doc, index) => (
            <View
              key={`${doc.url}-${index}`}
              className="mb-2 flex-row items-center gap-2"
            >
              <FileIcon size={18} color={colors.gold} />
              <GenieText variant="body-sm" className="flex-1" numberOfLines={1}>
                {doc.name || t('cases:details.untitledDocument')}
              </GenieText>
              {formatFileSize(doc.size) ? (
                <GenieText variant="caption" tone="muted">
                  {formatFileSize(doc.size)}
                </GenieText>
              ) : null}
            </View>
          ))}
        </Section>
      ) : null}

      {item.hearings?.length ? (
        <Section title={t('cases:details.hearings')}>
          {item.hearings.map(hearing => (
            <View key={hearing._id} className="mb-3 flex-row items-start gap-2">
              <View className="mt-0.5">
                <ClockIcon size={16} color={colors.gold} />
              </View>
              <View className="flex-1">
                <GenieText variant="body-sm" className="font-semibold">
                  {formatDate(hearing.date)}
                  {hearing.timeSlot ? ` · ${hearing.timeSlot}` : ''}
                </GenieText>
                {hearing.court ? (
                  <GenieText variant="caption" tone="secondary">
                    {hearing.court}
                  </GenieText>
                ) : null}
                {hearing.purpose ? (
                  <GenieText variant="caption" tone="secondary">
                    {hearing.purpose}
                  </GenieText>
                ) : null}
              </View>
              <GenieText variant="caption" tone="gold" className="font-semibold">
                {displayLabel('cases:status', hearing.status)}
              </GenieText>
            </View>
          ))}
        </Section>
      ) : null}

      {item.milestones?.length ? (
        <Section title={t('cases:details.milestones')}>
          {item.milestones.map((milestone, index) => (
            <View
              key={milestone._id ?? index}
              className="mb-2 flex-row items-center gap-2"
            >
              <View
                className={`h-2.5 w-2.5 rounded-full ${
                  milestone.isCompleted ? 'bg-gold' : 'bg-border'
                }`}
              />
              <GenieText variant="body-sm" className="flex-1">
                {milestone.title}
              </GenieText>
              <GenieText variant="caption" tone="muted">
                {formatDate(milestone.date)}
              </GenieText>
            </View>
          ))}
        </Section>
      ) : null}

      {item.closedDate ? (
        <Section title={t('cases:details.outcome')}>
          <Detail label={t('cases:details.closed')} value={formatDateTime(item.closedDate)} />
          <Detail label={t('cases:details.result')} value={item.caseOutcome} />
        </Section>
      ) : null}
    </GenieScreen>
  );
};
