import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import {
  GenieButton,
  GenieForm,
  GenieInput,
  GenieNotice,
  GeniePasswordInput,
  GenieScreen,
  GenieText,
  GenieTextInputRef,
  Logo,
} from '../../components';
import { BackIcon, MailIcon } from '../../components/icons/Icons';
import { authApi } from '../../api/authApi';
import { toAppError } from '../../utils/errors';
import {
  collectErrors,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateResetCode,
} from '../../utils/validation';
import type { AuthScreenProps } from '../../types/navigation';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

type Step = 'request' | 'reset';
type FormField = 'email' | 'code' | 'password' | 'confirmPassword';

export const ForgotPasswordScreen: React.FC<
  AuthScreenProps<'ForgotPassword'>
> = ({ navigation, route }) => {
  const { t } = useT();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordRef = useRef<GenieTextInputRef>(null);
  const confirmRef = useRef<GenieTextInputRef>(null);

  const clearFieldError = useCallback((field: FormField) => {
    setFieldErrors(current => ({ ...current, [field]: undefined }));
    setFormError(null);
  }, []);

  const requestCode = useCallback(async () => {
    if (isSubmitting) return;

    setFormError(null);
    setNotice(null);

    const errors = collectErrors<FormField>({ email: validateEmail(email) });
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      await authApi.forgotPassword(email.trim());
      setStep('reset');
      setNotice(t('auth:forgot.codeSent'));
    } catch (error) {
      setFormError(toAppError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isSubmitting, t]);

  const submitReset = useCallback(async () => {
    if (isSubmitting) return;

    setFormError(null);

    const errors = collectErrors<FormField>({
      email: validateEmail(email),
      code: validateResetCode(code),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    });

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      await authApi.resetPassword({
        email: email.trim(),
        token: code.trim(),
        newPassword: password,
      });

      navigation.replace('Login');
    } catch (error) {
      const info = toAppError(error);
      if (info.fieldErrors) {
        setFieldErrors(current => ({ ...current, ...info.fieldErrors }));
      }
      setFormError(info.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, confirmPassword, email, isSubmitting, navigation, password]);

  return (
    <GenieScreen scrollable>
      <View className="py-1">
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.goBack')}
          className="min-h-touch min-w-touch items-center justify-center self-start rounded-full active:bg-surface-alt"
        >
          <BackIcon size={20} color={colors.white} />
        </Pressable>
      </View>

      <View className="my-4 items-center">
        <Logo size={64} />
        <GenieText variant="heading-md" className="mt-2">
          {step === 'request' ? t('auth:forgot.title') : t('auth:forgot.resetTitle')}
        </GenieText>
        <GenieText
          variant="body-sm"
          tone="secondary"
          className="mt-1 max-w-[280px] text-center"
        >
          {step === 'request'
            ? t('auth:forgot.requestSubtitle')
            : t('auth:forgot.resetSubtitle')}
        </GenieText>
      </View>

      <GenieNotice message={formError} className="mb-3" />
      <GenieNotice message={notice} tone="gold" className="mb-3" />
      <GenieForm onSubmit={step === 'request' ? requestCode : submitReset}>
        <GenieInput
          label={t('auth:fields.email')}
          placeholder="you@example.com"
          value={email}
          onChangeText={value => {
            setEmail(value);
            clearFieldError('email');
          }}
          error={fieldErrors.email}
          leftIcon={<MailIcon size={20} color={colors.textMuted} />}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType={step === 'request' ? 'go' : 'next'}
          // On the web the surrounding <form> submits on Enter (single field).
          onSubmitEditing={step === 'request' && Platform.OS !== 'web' ? requestCode : undefined}
          editable={!isSubmitting && step === 'request'}
          containerClassName="mb-3"
        />

        {step === 'reset' && (
          <>
            <GenieInput
              label={t('auth:forgot.codeLabel')}
            autoComplete="one-time-code"
              placeholder={t('auth:otp.codePlaceholder')}
              value={code}
              onChangeText={value => {
                setCode(value.replace(/\D/g, '').slice(0, 6));
                clearFieldError('code');
              }}
              error={fieldErrors.code}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isSubmitting}
              containerClassName="mb-3"
            />
            <GeniePasswordInput
              ref={passwordRef}
              label={t('auth:forgot.newPassword')}
              autoComplete="new-password"
              placeholder={t('auth:fields.newPasswordPlaceholder')}
              value={password}
              onChangeText={value => {
                setPassword(value);
                clearFieldError('password');
                if (confirmPassword) clearFieldError('confirmPassword');
              }}
              error={fieldErrors.password}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              editable={!isSubmitting}
              containerClassName="mb-3"
            />
            <GeniePasswordInput
              ref={confirmRef}
              label={t('auth:forgot.confirmNewPassword')}
              autoComplete="new-password"
              placeholder={t('auth:forgot.confirmNewPasswordPlaceholder')}
              value={confirmPassword}
              onChangeText={value => {
                setConfirmPassword(value);
                clearFieldError('confirmPassword');
              }}
              error={fieldErrors.confirmPassword}
              returnKeyType="go"
              onSubmitEditing={submitReset}
              editable={!isSubmitting}
              containerClassName="mb-4"
            />
          </>
        )}

        <GenieButton
          label={step === 'request' ? t('auth:forgot.sendCode') : t('auth:forgot.resetTitle')}
          loadingLabel={step === 'request' ? t('common:actions.sending') : t('auth:forgot.resetting')}
          loading={isSubmitting}
          onPress={step === 'request' ? requestCode : submitReset}
        />
      </GenieForm>

      {step === 'reset' && (
        <Pressable
          onPress={() => {
            setStep('request');
            setCode('');
            setPassword('');
            setConfirmPassword('');
            setFieldErrors({});
            setFormError(null);
            setNotice(null);
          }}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('auth:forgot.useDifferentEmail')}
          className="mt-3 min-h-touch justify-center self-center px-2 active:opacity-70"
        >
          <GenieText variant="caption" tone="secondary" className="text-center">
            {t('auth:forgot.useDifferentEmail')}
          </GenieText>
        </Pressable>
      )}

      <View className="my-6 flex-row items-center justify-center">
        <GenieText variant="body-sm" tone="secondary">
          {`${t('auth:forgot.remembered')} `}
        </GenieText>
        <Pressable
          onPress={() => navigation.replace('Login')}
          hitSlop={8}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('auth:login.submit')}
          className="active:opacity-70"
        >
          <GenieText variant="label" tone="gold">
            {t('auth:login.submit')}
          </GenieText>
        </Pressable>
      </View>
    </GenieScreen>
  );
};
