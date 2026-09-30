import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieCard,
  GenieErrorState,
  GenieHeader,
  GenieScreen,
  GenieSettingsRow,
  GenieSkeleton,
  GenieText,
  VerifiedBadge,
  GenieRefreshControl,
} from '../../../components';
import {
  CameraIcon,
  FileIcon,
  InfoCircleIcon,
  ScalesIcon,
  SettingsIcon,
  StarIcon,
} from '../../../components/icons/ClientIcons';
import { UserIcon } from '../../../components/icons/Icons';
import { CrownIcon } from '../../../components/icons/LawyerIcons';
import { authApi } from '../../../api/authApi';
import { lawyerApi } from '../../../api/lawyerApi';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import type { LawyerVerificationStatus } from '../../../types/lawyer';
import type { LawyerTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { isLawyerVerified } from '../../../utils/verification';
import { pickProfilePhoto } from '../../../services/profilePhoto';
import type { ProfilePhotoUpload } from '../../../services/profilePhoto';
import { startTrace } from '../../../utils/perfTrace';
import type { PerfTrace } from '../../../utils/perfTrace';
import { useT } from '../../../i18n/useT';
import { practiceAreaLabel } from '../../../i18n/labels';

const VERIFICATION = {
  verified: { labelKey: 'lawyer:profile.verified', surface: 'bg-success-surface', tone: 'success' },
  pending: { labelKey: 'lawyer:profile.pending', surface: 'bg-warning-surface', tone: 'warning' },
  rejected: { labelKey: 'lawyer:profile.rejected', surface: 'bg-error-surface', tone: 'error' },
} as const satisfies Record<
  LawyerVerificationStatus,
  { labelKey: string; surface: string; tone: 'success' | 'warning' | 'error' }
>;

const Stat: React.FC<{ label: string; value: string | null }> = ({
  label,
  value,
}) =>
  value ? (
    <View className="flex-1 items-center">
      <GenieText variant="heading-md" tone="gold">
        {value}
      </GenieText>
      <GenieText variant="caption" tone="muted" className="mt-0.5 text-center">
        {label}
      </GenieText>
    </View>
  ) : null;

export const LawyerProfileScreen: React.FC<
  LawyerTabScreenProps<'LawyerProfile'>
> = ({ navigation }) => {
  const { t } = useT();
  const user = useAuthStore(state => state.user);
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['lawyer', 'profile', user?.id],
    queryFn: () => lawyerApi.getProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  const uploadFile = async (file: ProfilePhotoUpload, trace?: PerfTrace) => {
    setIsUploading(true);
    try {
      await authApi.uploadProfileImage(file);
      trace?.mark('uploaded');
      trace?.end();
      await queryClient.invalidateQueries({ queryKey: ['lawyer', 'profile', user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    } catch (err: any) {
      trace?.end('error');
      Alert.alert(
        t('profile:detail.uploadError'),
        err.message || t('profile:detail.uploadFailed'),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectImage = async () => {
    try {
      const trace = startTrace('profile-photo');
      const photo = await pickProfilePhoto(trace);
      if (photo) {
        await uploadFile(photo, trace);
      }
    } catch (err: any) {
      Alert.alert(t('profile:detail.uploadError'), err?.message || t('profile:detail.pickerFailed'));
    }
  };

  const header = (
    <GenieHeader
      title={t('lawyer:profile.title')}
      onMenu={openDrawer}
      onNotifications={() => navigation.navigate('Notifications')}
    />
  );

  if (profileQuery.isPending) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <View className="items-center">
          <GenieSkeleton className="h-24 w-24 rounded-full" />
          <GenieSkeleton className="mt-4 h-5 w-40" />
          <GenieSkeleton className="mt-2 h-3 w-28" />
        </View>
        <GenieSkeleton className="mt-6 h-64 w-full rounded-card" />
      </GenieScreen>
    );
  }

  if (profileQuery.isError) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <GenieErrorState
          message={profileQuery.error.message}
          onRetry={() => profileQuery.refetch()}
        />
      </GenieScreen>
    );
  }

  const profile = profileQuery.data;
  const verification =
    VERIFICATION[profile.verificationStatus] ?? VERIFICATION.pending;

  const hasRecord =
    profile.rating > 0 || profile.casesHandled > 0 || profile.winPercentage > 0;

  return (
    <GenieScreen
      scrollable
      header={header}
      dismissKeyboardOnTap={false}
      contentContainerClassName="pb-8"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={() => profileQuery.refetch()} />
        ),
      }}
    >
      <View className="my-3 items-center">
        <View className="relative">
          <GenieAvatar
            uri={profile.user?.profileImage}
            name={profile.user?.fullName ?? user?.fullName}
            size="xl"
            ring={profile.verificationStatus === 'verified'}
          />

          <Pressable
            onPress={handleSelectImage}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel={t('profile:detail.changePhoto')}
            accessibilityState={{ disabled: isUploading, busy: isUploading }}
            className={`absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gold active:opacity-80 ${
              isUploading ? 'opacity-50' : ''
            }`}
          >
            <CameraIcon size={16} color={colors.onGold} />
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center gap-1">
          <GenieText variant="heading-md">
            {profile.user?.fullName ?? user?.fullName ?? t('lawyer:profile.advocate')}
          </GenieText>
          {isLawyerVerified(profile) ? (
            <VerifiedBadge size={18} />
          ) : null}
        </View>

        {profile.specialization ? (
          <GenieText variant="body-sm" tone="gold" className="mt-1">
            {practiceAreaLabel(profile.specialization)}
          </GenieText>
        ) : null}

        <View className={`mt-2 rounded-pill px-3 py-1 ${verification.surface}`}>
          <GenieText variant="caption" tone={verification.tone} className="font-bold">
            {t(verification.labelKey)}
          </GenieText>
        </View>
      </View>

      {hasRecord ? (
        <GenieCard tone="surface" className="flex-row">
          <Stat
            label={
              t('lawyer:profile.reviews', { count: profile.totalReviews })
            }
            value={profile.rating > 0 ? profile.rating.toFixed(1) : null}
          />
          <Stat
            label={t('lawyer:profile.casesHandled')}
            value={profile.casesHandled > 0 ? String(profile.casesHandled) : null}
          />
          <Stat
            label={t('lawyer:profile.winRate')}
            value={profile.winPercentage > 0 ? `${profile.winPercentage}%` : null}
          />
        </GenieCard>
      ) : (
        <GenieCard tone="surface" className="flex-row items-center gap-2">
          <StarIcon size={16} color={colors.textMuted} />
          <GenieText variant="caption" tone="muted" className="flex-1">
            {t('lawyer:profile.noRecord')}
          </GenieText>
        </GenieCard>
      )}

      <GenieText
        variant="caption"
        tone="muted"
        className="mb-2 ml-1 mt-6 font-bold tracking-widest"
      >
        {t('lawyer:profile.accountSection')}
      </GenieText>

      <View className="overflow-hidden rounded-card border border-border bg-surface">
        <GenieSettingsRow
          label={t('lawyer:profile.myProfile')}
          subtitle={profile.user?.email ?? undefined}
          icon={<UserIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('LawyerMyProfile')}
        />
        <View className="ml-4 h-px bg-border" />
        <GenieSettingsRow
          label={t('lawyer:profile.professional')}
          subtitle={t('lawyer:profile.professionalSub')}
          icon={<InfoCircleIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('ProfessionalDetails')}
        />
        <View className="ml-4 h-px bg-border" />
        <GenieSettingsRow
          label={t('lawyer:profile.documents')}
          subtitle={t('lawyer:profile.documentsSub')}
          icon={<FileIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('Documents')}
        />
        <View className="ml-4 h-px bg-border" />
        <GenieSettingsRow
          label={t('lawyer:profile.hearings')}
          subtitle={t('lawyer:profile.hearingsSub')}
          icon={<ScalesIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('Hearings')}
        />
        <View className="ml-4 h-px bg-border" />
        <GenieSettingsRow
          label={t('lawyer:profile.reviewsLabel')}
          subtitle={t('lawyer:profile.clientReviews', { count: profile.totalReviews })}
          icon={<StarIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('LawyerReviews')}
        />
        <View className="ml-4 h-px bg-border" />
        <GenieSettingsRow
          label={t('lawyer:profile.subscription')}
          subtitle={t('lawyer:profile.planName', { plan: profile.subscriptionPlan })}
          icon={<CrownIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('Subscription')}
        />
        <View className="ml-4 h-px bg-border" />
        <GenieSettingsRow
          label={t('lawyer:profile.settings')}
          subtitle={t('lawyer:profile.settingsSub')}
          icon={<SettingsIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('Settings')}
        />
      </View>
    </GenieScreen>
  );
};
