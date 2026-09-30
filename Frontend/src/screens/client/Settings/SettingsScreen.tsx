import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import {
  ContactSupportRows,
  GenieButton,
  GenieForm,
  GenieHeader,
  GenieInput,
  GenieModal,
  GenieNotice,
  GenieScreen,
  GenieSettingsGroup,
  GenieSettingsRow,
  GenieText,
} from '../../../components';
import {
  BellIcon,
  GlobeIcon,
  InfoCircleIcon,
  LogoutIcon,
  SettingsIcon,
  ShieldIcon,
  TrashIcon,
} from '../../../components/icons/ClientIcons';
import { LockIcon } from '../../../components/icons/Icons';
import { authApi } from '../../../api/authApi';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { SUPPORTED_LANGUAGES } from '../../../i18n/config';
import { currentLanguage } from '../../../i18n';
import { LanguageSheet } from '../../../components/settings/LanguageSheet';
import { toAppError } from '../../../utils/errors';

export const SettingsScreen: React.FC<ClientStackScreenProps<'Settings'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const logout = useAuthStore(state => state.logout);
  const userEmail = useAuthStore(state => state.user?.email ?? '');
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const languageName =
    SUPPORTED_LANGUAGES.find(language => language.code === currentLanguage())?.nativeName ?? '';
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      queryClient.clear();
      await logout();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!confirmPassword) {
      setDeleteError(t('settings:deleteAccount.passwordRequired'));
      return;
    }

    setIsDeleting(true);
    try {
      await authApi.deleteAccount(confirmPassword);
      setShowDeleteModal(false);
      queryClient.clear();
      await logout();
    } catch (err) {
      setDeleteError(toAppError(err).message || t('settings:deleteAccount.failed'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <GenieScreen
      scrollable
      dismissKeyboardOnTap={false}
      header={
        <GenieHeader
          title={t('common:nav.settings')}
          onMenu={openDrawer}
          onBack={
            navigation.canGoBack() ? () => navigation.goBack() : undefined
          }
        />
      }
      contentContainerClassName="pb-10"
    >
      <GenieSettingsGroup title={t('settings:groups.preferences')} className="mb-5">
        <GenieSettingsRow
          label={t('settings:pushNotifications')}
          icon={<BellIcon size={18} color={colors.white} />}
          trailing={
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              accessibilityLabel={t('settings:pushNotifications')}
              trackColor={{ false: colors.disabled, true: colors.gold }}
              thumbColor={pushNotifications ? colors.white : colors.textMuted}
            />
          }
        />
        <GenieSettingsRow
          label={t('settings:appTheme')}
          icon={<SettingsIcon size={18} color={colors.white} />}
          value={t('settings:themeBlackDefault')}
        />
        <GenieSettingsRow
          label={t('settings:language.title')}
          icon={<GlobeIcon size={18} color={colors.white} />}
          value={languageName}
          onPress={() => setShowLanguageSheet(true)}
        />
      </GenieSettingsGroup>

      <GenieSettingsGroup title={t('settings:groups.supportLegal')} className="mb-5">
        <ContactSupportRows />
        <GenieSettingsRow
          label={t('settings:aboutGenieLaw')}
          icon={<InfoCircleIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('AboutUs')}
        />
        <GenieSettingsRow
          label={t('settings:privacyPolicy')}
          icon={<ShieldIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        />
        <GenieSettingsRow
          label={t('settings:termsConditions')}
          icon={<ShieldIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('TermsConditions')}
        />
      </GenieSettingsGroup>

      <GenieSettingsGroup title={t('settings:groups.account')}>
        <GenieSettingsRow
          label={t('settings:changePassword')}
          icon={<LockIcon size={18} color={colors.white} />}
          onPress={() => navigation.navigate('ChangePassword')}
        />
        <GenieSettingsRow
          label={isSigningOut ? t('common:actions.signingOut') : t('common:actions.signOut')}
          icon={<LogoutIcon size={18} color={colors.warning} />}
          tone="warning"
          disabled={isSigningOut}
          onPress={handleSignOut}
        />
        <GenieSettingsRow
          label={t('settings:deleteAccount.title')}
          icon={<TrashIcon size={18} color={colors.error} />}
          tone="danger"
          onPress={() => {
            setDeleteError(null);
            setConfirmPassword('');
            setShowDeleteModal(true);
          }}
        />
      </GenieSettingsGroup>

      <GenieModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('settings:deleteAccount.title')}
        dismissOnBackdropPress={false}
        footer={
          <View className="flex-row gap-3">
            <GenieButton
              label={t('common:actions.cancel')}
              variant="ghost"
              disabled={isDeleting}
              onPress={() => setShowDeleteModal(false)}
              className="flex-1"
            />
            <GenieButton
              label={t('settings:deleteAccount.confirm')}
              loadingLabel={t('settings:deleteAccount.deleting')}
              variant="danger"
              loading={isDeleting}
              onPress={handleDeleteAccount}
              className="flex-1"
            />
          </View>
        }
      >
        <GenieText variant="body-md" tone="secondary" className="mb-4">
          {t('settings:deleteAccount.warning')}
        </GenieText>

        {deleteError ? (
          <View className="mb-3">
            <GenieNotice message={deleteError} />
          </View>
        ) : null}

        <GenieForm onSubmit={handleDeleteAccount} username={userEmail}>
          <GenieInput
            label={t('settings:deleteAccount.passwordLabel')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('settings:deleteAccount.passwordPlaceholder')}
            secureTextEntry
            autoComplete="current-password"
          />
        </GenieForm>
      </GenieModal>

      <LanguageSheet visible={showLanguageSheet} onClose={() => setShowLanguageSheet(false)} />
    </GenieScreen>
  );
};
