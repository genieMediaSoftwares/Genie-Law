import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieAvatar,
  GenieButton,
  GenieCard,
  GenieErrorState,
  GenieHeader,
  GenieScreen,
  GenieSkeleton,
  GenieText,
  VerifiedBadge,
} from '../../../components';
import { CameraIcon } from '../../../components/icons/ClientIcons';
import { authApi } from '../../../api/authApi';
import { lawyerApi } from '../../../api/lawyerApi';
import { useAuthStore } from '../../../store/authStore';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { isLawyerVerified } from '../../../utils/verification';
import { pickProfilePhoto } from '../../../services/profilePhoto';
import type { ProfilePhotoUpload } from '../../../services/profilePhoto';
import { startTrace } from '../../../utils/perfTrace';
import type { PerfTrace } from '../../../utils/perfTrace';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

const InfoRow: React.FC<{ label: string; value: string; isLast?: boolean }> = ({
  label,
  value,
  isLast = false,
}) => (
  <View className={isLast ? 'pt-2' : 'border-b border-border py-2'}>
    <GenieText variant="caption" tone="muted">
      {label}
    </GenieText>
    <GenieText variant="body-sm" className="mt-0.5 font-medium">
      {value}
    </GenieText>
  </View>
);

// The lawyer counterpart of the client's "My Profile" screen: the same
// account-summary layout (photo, Account Summary card, edit button), backed
// by the lawyer's own profile record instead of the client's.
export const LawyerMyProfileScreen: React.FC<
  LawyerStackScreenProps<'LawyerMyProfile'>
> = ({ navigation }) => {
  const { t } = useT();
  const authUser = useAuthStore(state => state.user);
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['lawyer', 'profile', authUser?.id],
    queryFn: () => lawyerApi.getProfile(authUser!.id),
    enabled: Boolean(authUser?.id),
  });

  const user = profileQuery.data?.user;

  const uploadFile = async (file: ProfilePhotoUpload, trace?: PerfTrace) => {
    setIsUploading(true);
    try {
      await authApi.uploadProfileImage(file);
      trace?.mark('uploaded');
      trace?.end();
      await queryClient.invalidateQueries({ queryKey: ['lawyer', 'profile', authUser?.id] });
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

  const header = <GenieHeader title={t('profile:detail.title')} onBack={() => navigation.goBack()} />;

  if (profileQuery.isPending) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <View className="items-center">
          <GenieSkeleton className="h-24 w-24 rounded-full" />
          <GenieSkeleton className="mt-6 h-60 w-full rounded-card" />
        </View>
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

  if (!user) {
    return <GenieScreen header={header} dismissKeyboardOnTap={false}>{null}</GenieScreen>;
  }

  return (
    <GenieScreen
      scrollable
      header={header}
      dismissKeyboardOnTap={false}
      contentContainerClassName="pb-10"
    >
      <View className="my-3 items-center">
        <View className="rounded-full border-2 border-border p-1">
          <GenieAvatar uri={user.profileImage} name={user.fullName} size="xl" />

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
          <GenieText variant="heading-md">{user.fullName}</GenieText>
          {isLawyerVerified(profileQuery.data) ? <VerifiedBadge size={18} /> : null}
        </View>

        <GenieText
          variant="caption"
          tone="gold"
          className="mt-0.5 font-medium tracking-widest"
        >
          {displayLabel('common:roles', user.role || 'lawyer').toUpperCase()}
        </GenieText>
      </View>

      <GenieCard tone="surface" className="mt-3 p-4">
        <GenieText
          variant="caption"
          tone="gold"
          className="mb-3 font-bold uppercase tracking-widest"
        >
          {t('profile:detail.accountSummary')}
        </GenieText>

        <InfoRow label={t('profile:detail.fullName')} value={user.fullName} />
        <InfoRow label={t('profile:detail.email')} value={user.email} />
        <InfoRow label={t('profile:detail.phone')} value={user.mobile || t('profile:detail.notSet')} />
        <InfoRow
          label={t('profile:detail.location')}
          value={user.location || t('profile:detail.notSet')}
          isLast
        />
      </GenieCard>

      <GenieButton
        label={t('profile:detail.edit')}
        onPress={() => navigation.navigate('ProfessionalDetails')}
        className="mt-5"
      />
    </GenieScreen>
  );
};
