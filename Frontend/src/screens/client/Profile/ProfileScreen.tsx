import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

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
  ClockIcon,
  FileIcon,
  InfoCircleIcon,
  SettingsIcon,
} from '../../../components/icons/ClientIcons';
import { UserIcon } from '../../../components/icons/Icons';
import { clientApi, notificationsApi } from '../../../api/clientApi';
import { useUiStore } from '../../../store/uiStore';
import type { ClientTabScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { displayLabel } from '../../../i18n/labels';

export const ProfileScreen: React.FC<ClientTabScreenProps<'Profile'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const openDrawer = useUiStore(state => state.openDrawer);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 1],
    queryFn: () => notificationsApi.list(1, 15),
  });

  const profileQuery = useQuery({
    queryKey: ['client', 'profile'],
    queryFn: clientApi.getProfile,
  });

  const user = profileQuery.data?.user;

  const menuItems = [
    {
      id: 'my-profile',
      title: t('profile:menu.myProfile'),
      subtitle: t('profile:menu.myProfileSub'),
      icon: <UserIcon size={20} color={colors.white} />,
      onPress: () => navigation.navigate('MyProfileDetail'),
    },
    {
      id: 'personal-info',
      title: t('profile:menu.personalInfo'),
      subtitle: t('profile:menu.personalInfoSub'),
      icon: <InfoCircleIcon size={20} color={colors.white} />,
      onPress: () => navigation.navigate('PersonalInformation'),
    },
    {
      id: 'appointments',
      title: t('profile:menu.appointments'),
      subtitle: t('profile:menu.appointmentsSub'),
      icon: <ClockIcon size={20} color={colors.white} />,
      onPress: () => navigation.navigate('Appointments'),
    },
    {
      id: 'my-documents',
      title: t('profile:menu.documents'),
      subtitle: t('profile:menu.documentsSub'),
      icon: <FileIcon size={20} color={colors.white} />,
      onPress: () => navigation.navigate('Documents'),
    },
    {
      id: 'recent-activity',
      title: t('profile:menu.activity'),
      subtitle: t('profile:menu.activitySub'),
      icon: <ClockIcon size={20} color={colors.white} />,
      onPress: () => navigation.navigate('RecentActivity'),
    },
    {
      id: 'settings',
      title: t('profile:menu.settings'),
      subtitle: t('profile:menu.settingsSub'),
      icon: <SettingsIcon size={20} color={colors.white} />,
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  const header = (
    <GenieHeader
      title={t('profile:title')}
      onMenu={openDrawer}
      onNotifications={() => navigation.navigate('Notifications')}
      notificationCount={notificationsQuery.data?.unreadCount ?? 0}
    />
  );

  if (profileQuery.isPending) {
    return (
      <GenieScreen header={header} dismissKeyboardOnTap={false}>
        <GenieSkeleton className="h-24 w-full rounded-card" />
        <GenieSkeleton className="mt-4 h-80 w-full rounded-card" />
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
      contentContainerClassName="pb-20"
      scrollViewProps={{
        refreshControl: (
          <GenieRefreshControl onRefresh={() => profileQuery.refetch()} />
        ),
      }}
    >
      <GenieCard tone="card" className="mb-4 flex-row items-center p-4">
        <GenieAvatar uri={user.profileImage} name={user.fullName} size="profile" />

        <View className="ml-4 flex-1">
          <View className="flex-row items-center gap-1">
            <GenieText variant="sectionTitle" numberOfLines={1}>
              {user.fullName}
            </GenieText>
            {user.isVerified ? <VerifiedBadge size={16} /> : null}
          </View>

          <GenieText variant="body-sm" tone="secondary" numberOfLines={1} className="mt-0.5">
            {user.email}
          </GenieText>

          <View className="mt-2 h-7 items-center justify-center self-start rounded-full bg-surface-secondary px-2.5">
            <GenieText variant="caption" tone="secondary" className="font-semibold tracking-widest">
              {displayLabel('common:roles', user.role || 'client').toUpperCase()}
            </GenieText>
          </View>
        </View>
      </GenieCard>

      <View className="overflow-hidden rounded-card bg-card">
        {menuItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 ? <View className="ml-4 h-px bg-border" /> : null}
            <GenieSettingsRow
              label={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              onPress={item.onPress}
            />
          </React.Fragment>
        ))}
      </View>
    </GenieScreen>
  );
};
