import React, { useState } from 'react';

import {
  GenieButton,
  GenieCard,
  GenieForm,
  GenieHeader,
  GenieNotice,
  GeniePasswordInput,
  GenieScreen,
  GenieText,
} from '../../../components';
import { authApi } from '../../../api/authApi';
import { useAuthStore } from '../../../store/authStore';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { useT } from '../../../i18n/useT';

export const ChangePasswordScreen: React.FC<
  ClientStackScreenProps<'ChangePassword'>
> = ({ navigation }) => {
  const { t } = useT();
  const userEmail = useAuthStore(state => state.user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg(t('settings:password.currentRequired'));
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg(t('settings:password.tooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t('settings:password.mismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.changePassword({
        currentPassword,
        oldPassword: currentPassword,
        newPassword,
      });

      setSuccessMsg(t('settings:password.updated'));
      setTimeout(() => {
        navigation.goBack();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(
        err.message || t('settings:password.failed'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GenieScreen
      scrollable
      header={
        <GenieHeader title={t('settings:password.title')} onBack={() => navigation.goBack()} />
      }
      contentContainerClassName="pb-10"
      scrollViewProps={{ keyboardShouldPersistTaps: 'handled' }}
    >
      <GenieNotice message={errorMsg} className="mb-3" />
      <GenieNotice message={successMsg} tone="success" className="mb-3" />

      <GenieForm onSubmit={handleSubmit} username={userEmail}>
        <GenieCard tone="surface" className="p-4">
          <GenieText
            variant="caption"
            tone="gold"
            className="mb-4 font-bold uppercase tracking-widest"
          >
            {t('settings:password.heading')}
          </GenieText>

          <GeniePasswordInput
            label={t('settings:password.current')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('settings:password.currentPlaceholder')}
            autoComplete="current-password"
            containerClassName="mb-3"
          />

          <GeniePasswordInput
            label={t('settings:password.new')}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('settings:password.newPlaceholder')}
            autoComplete="new-password"
            containerClassName="mb-3"
          />

          <GeniePasswordInput
            label={t('settings:password.confirm')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('settings:password.confirmPlaceholder')}
            autoComplete="new-password"
          />
        </GenieCard>

        <GenieButton
          label={t('settings:password.update')}
          loadingLabel={t('settings:password.updating')}
          loading={isLoading}
          onPress={handleSubmit}
          className="mt-5"
        />
      </GenieForm>
    </GenieScreen>
  );
};
