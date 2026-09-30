import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieButton,
  GenieCard,
  GenieErrorState,
  GenieHeader,
  GenieInput,
  GenieNotice,
  GenieScreen,
  GenieSkeleton,
  GenieText,
} from '../../../components';
import { clientApi } from '../../../api/clientApi';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { useT } from '../../../i18n/useT';

export const PersonalInformationScreen: React.FC<
  ClientStackScreenProps<'PersonalInformation'>
> = ({ navigation }) => {
  const { t } = useT();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['client', 'profile'],
    queryFn: clientApi.getProfile,
  });

  const user = profileQuery.data?.user;

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [location, setLocation] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [languagesStr, setLanguagesStr] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setMobile(user.mobile || '');
      setLocation(user.location || '');
      setDob(user.dob || '');
      setGender(user.gender || '');
      setLanguagesStr(user.languages?.join(', ') || '');
    }
  }, [user]);

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    if (!fullName.trim()) {
      setSaveError(t('profile:personal.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const languagesArray = languagesStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await clientApi.updateProfile({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        location: location.trim(),
        dob: dob.trim(),
        gender: gender.trim().toLowerCase(),
        languages: languagesArray,
      });

      await queryClient.invalidateQueries({ queryKey: ['client', 'profile'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });

      setSaveSuccess(true);
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } catch (err: any) {
      setSaveError(err.message || t('profile:personal.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const header = (
    <GenieHeader
      title={t('profile:personal.title')}
      onBack={() => navigation.goBack()}
    />
  );

  if (profileQuery.isPending) {
    return (
      <GenieScreen header={header}>
        {[0, 1, 2, 3].map(i => (
          <GenieSkeleton key={i} className={`h-14 w-full ${i > 0 ? 'mt-3' : ''}`} />
        ))}
      </GenieScreen>
    );
  }

  if (profileQuery.isError) {
    return (
      <GenieScreen header={header}>
        <GenieErrorState
          message={profileQuery.error.message}
          onRetry={() => profileQuery.refetch()}
        />
      </GenieScreen>
    );
  }

  return (
    <GenieScreen
      scrollable
      header={header}
      contentContainerClassName="pb-10"
      scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}
    >
      <GenieNotice message={saveError} className="mb-3" />
      <GenieNotice
        message={saveSuccess ? t('profile:personal.updated') : null}
        tone="success"
        className="mb-3"
      />

      <GenieCard tone="surface" className="p-4">
        <GenieText
          variant="sectionTitle"
          tone="gold"
          className="mb-3 font-bold uppercase tracking-widest"
        >
          {t('profile:personal.editHeading')}
        </GenieText>

        <GenieInput
          label={t('profile:personal.fullName')}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('profile:personal.fullNamePlaceholder')}
          containerClassName="mb-3"
        />

        <GenieInput
          label={t('profile:personal.phone')}
          value={mobile}
          onChangeText={setMobile}
          placeholder={t('profile:personal.phonePlaceholder')}
          keyboardType="phone-pad"
          containerClassName="mb-3"
        />

        <GenieInput
          label={t('profile:personal.location')}
          value={location}
          onChangeText={setLocation}
          placeholder={t('profile:personal.locationPlaceholder')}
          containerClassName="mb-3"
        />

        <GenieInput
          label={t('profile:personal.dob')}
          value={dob}
          onChangeText={setDob}
          placeholder={t('profile:personal.dobPlaceholder')}
          containerClassName="mb-3"
        />

        <GenieInput
          label={t('profile:personal.gender')}
          value={gender}
          onChangeText={setGender}
          placeholder={t('profile:personal.genderPlaceholder')}
          containerClassName="mb-3"
        />

        <GenieInput
          label={t('profile:personal.languages')}
          value={languagesStr}
          onChangeText={setLanguagesStr}
          placeholder={t('profile:personal.languagesPlaceholder')}
          helperText={t('profile:personal.languagesHelper')}
        />
      </GenieCard>

      <GenieButton
        label={t('profile:personal.save')}
        loadingLabel={t('profile:personal.saving')}
        loading={isSaving}
        onPress={handleSave}
        className="mt-5"
      />
    </GenieScreen>
  );
};
