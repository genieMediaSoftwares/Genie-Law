import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
import { lawyerApi } from '../../../api/lawyerApi';
import { useAuthStore } from '../../../store/authStore';
import { toAppError } from '../../../utils/errors';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { useT } from '../../../i18n/useT';

export const ProfessionalDetailsScreen: React.FC<
  LawyerStackScreenProps<'ProfessionalDetails'>
> = ({ navigation }) => {
  const { t } = useT();
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['lawyer', 'profile', user?.id],
    queryFn: () => lawyerApi.getProfile(user!.id),
    enabled: Boolean(user?.id),
  });

  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [barCouncilNumber, setBarCouncilNumber] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [bio, setBio] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const profile = profileQuery.data;

  useEffect(() => {
    if (profile) {
      setSpecialization(profile.specialization ?? '');
      setExperience(profile.experience ? String(profile.experience) : '');
      setEducation(profile.education ?? '');
      setBarCouncilNumber(profile.barCouncilNumber ?? '');
      setConsultationFee(
        profile.consultationFee ? String(profile.consultationFee) : '',
      );
      setOfficeAddress(profile.officeAddress ?? '');
      setWorkingHours(profile.workingHours ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () =>
      lawyerApi.updateProfile({
        specialization: specialization.trim(),
        experience: experience.trim() ? Number(experience.trim()) : 0,
        education: education.trim(),
        barCouncilNumber: barCouncilNumber.trim(),
        consultationFee: consultationFee.trim()
          ? Number(consultationFee.trim())
          : 0,
        officeAddress: officeAddress.trim(),
        workingHours: workingHours.trim(),
        bio: bio.trim(),
      }),
    onError: error => setFormError(toAppError(error).message),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['lawyer', 'profile'] });
      setTimeout(() => navigation.goBack(), 900);
    },
  });

  const handleSave = () => {
    setFormError(null);
    setSaved(false);

    if (!specialization.trim()) {
      setFormError(t('lawyer:professional.specRequired'));
      return;
    }
    if (experience.trim() && Number.isNaN(Number(experience.trim()))) {
      setFormError(t('lawyer:professional.expNumber'));
      return;
    }
    if (consultationFee.trim() && Number.isNaN(Number(consultationFee.trim()))) {
      setFormError(t('lawyer:professional.feeNumber'));
      return;
    }

    saveMutation.mutate();
  };

  const header = (
    <GenieHeader
      title={t('lawyer:professional.title')}
      onBack={() => navigation.goBack()}
    />
  );

  if (profileQuery.isPending) {
    return (
      <GenieScreen header={header}>
        {[0, 1, 2, 3, 4].map(i => (
          <GenieSkeleton key={i} className={`h-14 w-full ${i ? 'mt-3' : ''}`} />
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
      <GenieNotice message={formError} className="mb-3" />
      <GenieNotice
        message={saved ? t('lawyer:professional.updated') : null}
        tone="success"
        className="mb-3"
      />

      <GenieCard tone="surface" className="p-4">
        <GenieText
          variant="caption"
          tone="gold"
          className="mb-4 font-bold uppercase tracking-widest"
        >
          {t('lawyer:professional.practice')}
        </GenieText>

        <GenieInput
          label={t('lawyer:professional.specialization')}
          value={specialization}
          onChangeText={setSpecialization}
          placeholder={t('lawyer:professional.specializationPlaceholder')}
          containerClassName="mb-3"
        />
        <GenieInput
          label={t('lawyer:professional.experience')}
          value={experience}
          onChangeText={setExperience}
          placeholder={t('lawyer:professional.experiencePlaceholder')}
          keyboardType="number-pad"
          containerClassName="mb-3"
        />
        <GenieInput
          label={t('lawyer:professional.barNumber')}
          value={barCouncilNumber}
          onChangeText={setBarCouncilNumber}
          placeholder={t('lawyer:professional.barNumberPlaceholder')}
          containerClassName="mb-3"
        />
        <GenieInput
          label={t('lawyer:professional.education')}
          value={education}
          onChangeText={setEducation}
          placeholder={t('lawyer:professional.educationPlaceholder')}
          containerClassName="mb-3"
        />
        <GenieInput
          label={t('lawyer:professional.fee')}
          value={consultationFee}
          onChangeText={setConsultationFee}
          placeholder={t('lawyer:professional.feePlaceholder')}
          keyboardType="number-pad"
          helperText={t('lawyer:professional.feeHelper')}
        />
      </GenieCard>

      <GenieCard tone="surface" className="mt-4 p-4">
        <GenieText
          variant="caption"
          tone="gold"
          className="mb-4 font-bold uppercase tracking-widest"
        >
          {t('lawyer:professional.practiceDetails')}
        </GenieText>

        <GenieInput
          label={t('lawyer:professional.office')}
          value={officeAddress}
          onChangeText={setOfficeAddress}
          placeholder={t('lawyer:professional.officePlaceholder')}
          containerClassName="mb-3"
        />
        <GenieInput
          label={t('lawyer:professional.hours')}
          value={workingHours}
          onChangeText={setWorkingHours}
          placeholder={t('lawyer:professional.hoursPlaceholder')}
          containerClassName="mb-3"
        />
        <GenieInput
          label={t('lawyer:professional.about')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('lawyer:professional.aboutPlaceholder')}
          multiline
          numberOfLines={4}
          className="h-24"
        />
      </GenieCard>

      <GenieButton
        label={t('lawyer:professional.save')}
        loadingLabel={t('lawyer:professional.saving')}
        loading={saveMutation.isPending}
        onPress={handleSave}
        className="mt-5"
      />
    </GenieScreen>
  );
};
