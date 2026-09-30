import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  GenieButton,
  GenieForm,
  GenieInput,
  GenieNotice,
  GeniePasswordInput,
  GenieScreen,
  GenieText,
  GenieTextInputRef,
  GoogleButton,
  Logo,
} from '../../components';
import { MailIcon } from '../../components/icons/Icons';
import { useAuthStore } from '../../store/authStore';
import { DEFAULT_ROLE } from '../../constants/roles';
import { consumeGoogleRedirect } from '../../services/googleSignIn';
import type { PendingVerification } from '../../types/auth';
import { toAppError } from '../../utils/errors';
import {
  collectErrors,
  validateEmail,
  validateLoginPassword,
} from '../../utils/validation';
import type { AuthScreenProps } from '../../types/navigation';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

type FormField = 'email' | 'password';

export const LoginScreen: React.FC<AuthScreenProps<'Login'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const login = useAuthStore(state => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRef = useRef<GenieTextInputRef>(null);
  const completeSession = useAuthStore(state => state.completeSession);

  useEffect(() => {
    let active = true;
    consumeGoogleRedirect()
      .then(async outcome => {
        if (!active || !outcome) return;
        if (outcome.kind === 'session') await completeSession(outcome.session);
        else if (outcome.kind === 'cancelled') setNotice(t('auth:google.cancelled'));
        else if (outcome.kind === 'failed') setFormError(outcome.message);
      })
      .catch(error => active && setFormError(toAppError(error).message));
    return () => {
      active = false;
    };
  }, [completeSession, t]);

  const clearMessages = useCallback(() => {
    setFormError(null);
    setNotice(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    clearMessages();

    const errors = collectErrors<FormField>({
      email: validateEmail(email),
      password: validateLoginPassword(password),
    });

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (error) {
      const info = toAppError(error);
      if (info.code === 'CONTACT_VERIFICATION_REQUIRED' && info.data) {
        const pending = info.data as unknown as PendingVerification;
        navigation.navigate('VerifyContact', {
          verificationToken: pending.verificationToken,
          channels: pending.channels,
          email: pending.user.email,
        });
        return;
      }
      if (info.fieldErrors) {
        setFieldErrors(current => ({ ...current, ...info.fieldErrors }));
      }
      setFormError(info.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [clearMessages, email, isSubmitting, login, navigation, password]);

  return (
    <GenieScreen scrollable>
      <View className="items-center pt-8 pb-4">
        <Logo size={80} />
      </View>

      <View className="mb-8 mt-2">
        <GenieText variant="heading-lg" className="text-center">
          {t('auth:login.title')}
        </GenieText>
        <GenieText variant="body" tone="secondary" className="mt-2 text-center">
          {t('auth:login.subtitle')}
        </GenieText>
      </View>

      <GenieNotice message={formError} tone="error" className="mb-3" />
      <GenieNotice message={notice} tone="gold" className="mb-3" />

      <GenieForm onSubmit={handleSubmit}>
        <GenieInput
          label={t('auth:fields.email')}
          placeholder="you@example.com"
          value={email}
          onChangeText={value => {
            setEmail(value);
            setFieldErrors(current => ({ ...current, email: undefined }));
            clearMessages();
          }}
          error={fieldErrors.email}
          leftIcon={<MailIcon size={20} color={colors.textMuted} />}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!isSubmitting}
          containerClassName="mb-3"
        />

        <GeniePasswordInput
          ref={passwordRef}
          label={t('auth:fields.password')}
          placeholder={t('auth:fields.passwordPlaceholder')}
          autoComplete="current-password"
          value={password}
          onChangeText={value => {
            setPassword(value);
            setFieldErrors(current => ({ ...current, password: undefined }));
            clearMessages();
          }}
          error={fieldErrors.password}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!isSubmitting}
          containerClassName="mb-2"
        />

        <Pressable
          onPress={() =>
            navigation.navigate('ForgotPassword', {
              email: email.trim() || undefined,
            })
          }
          hitSlop={8}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('auth:login.forgotPassword')}
          className="mb-5 min-h-touch justify-center self-end px-1 active:opacity-70"
        >
          <GenieText variant="label" tone="gold">
            {t('auth:login.forgotPassword')}
          </GenieText>
        </Pressable>

        <GenieButton
          label={t('auth:login.submit')}
          loadingLabel={t('auth:login.submitting')}
          loading={isSubmitting}
          onPress={handleSubmit}
        />
      </GenieForm>

      <View className="my-5 flex-row items-center gap-3">
        <View className="flex-1 h-px bg-border" />
        <GenieText variant="caption" tone="muted" className="px-1">
          {t('auth:login.orContinueWith')}
        </GenieText>
        <View className="flex-1 h-px bg-border" />
      </View>

      <GoogleButton role={DEFAULT_ROLE} onMessage={setNotice} disabled={isSubmitting} />

      <View className="mt-6 flex-row items-center justify-center">
        <GenieText variant="body-sm" tone="secondary">
          {`${t('auth:login.noAccount')} `}
        </GenieText>
        <Pressable
          onPress={() => navigation.replace('Signup')}
          hitSlop={8}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('auth:signup.link')}
          className="active:opacity-70"
        >
          <GenieText variant="label" tone="gold">
            {t('auth:signup.link')}
          </GenieText>
        </Pressable>
      </View>
    </GenieScreen>
  );
};
