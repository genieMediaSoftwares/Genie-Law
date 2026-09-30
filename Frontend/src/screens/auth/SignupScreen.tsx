import React, { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AuthTabs,
  GenieButton,
  GenieDivider,
  GenieForm,
  GenieInput,
  GenieNotice,
  GeniePasswordInput,
  GenieScreen,
  GenieText,
  GenieTextInputRef,
  GoogleButton,
  Logo,
  RolePicker,
} from '../../components';
import { MailIcon, PhoneIcon, UserIcon } from '../../components/icons/Icons';
import { DEFAULT_ROLE } from '../../constants/roles';
import { useAuthStore } from '../../store/authStore';
import { toAppError } from '../../utils/errors';
import {
  collectErrors,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateMobile,
  validatePassword,
} from '../../utils/validation';
import type { SignupRole } from '../../types/auth';
import type { AuthScreenProps } from '../../types/navigation';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

type FormField =
  | 'fullName'
  | 'email'
  | 'mobile'
  | 'password'
  | 'confirmPassword';

export const SignupScreen: React.FC<AuthScreenProps<'Signup'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const signup = useAuthStore(state => state.signup);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<SignupRole>(DEFAULT_ROLE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRef = useRef<GenieTextInputRef>(null);
  const mobileRef = useRef<GenieTextInputRef>(null);
  const passwordRef = useRef<GenieTextInputRef>(null);
  const confirmRef = useRef<GenieTextInputRef>(null);

  const clearFieldError = useCallback((field: FormField) => {
    setFieldErrors(current => ({ ...current, [field]: undefined }));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    setFormError(null);

    const errors = collectErrors<FormField>({
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      mobile: validateMobile(mobile),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    });

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const pending = await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password,
        role,
      });
      navigation.replace('VerifyContact', {
        verificationToken: pending.verificationToken,
        channels: pending.channels,
        email: pending.user.email,
      });
    } catch (error) {
      const info = toAppError(error);
      if (info.fieldErrors) {
        setFieldErrors(current => ({ ...current, ...info.fieldErrors }));
      }
      setFormError(info.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    confirmPassword,
    email,
    fullName,
    isSubmitting,
    mobile,
    navigation,
    password,
    role,
    signup,
  ]);

  return (
    <GenieScreen scrollable>
      <AuthTabs
        active="signup"
        onSelectLogin={() => navigation.replace('Login')}
        onSelectSignup={() => {}}
      />

      <View className="my-4 items-center">
        <Logo size={64} />
        <GenieText variant="heading-md" className="mt-2">
          {t('auth:signup.title')}
        </GenieText>
        <GenieText variant="body-lg" tone="secondary" className="mt-1">
          {t('auth:signup.subtitle')}
        </GenieText>
      </View>

      <GenieNotice message={formError} className="mb-3" />

      <GenieForm onSubmit={handleSubmit}>
        <GenieInput
          label={t('auth:fields.fullName')}
          placeholder={t('auth:fields.fullNamePlaceholder')}
          value={fullName}
          onChangeText={value => {
            setFullName(value);
            clearFieldError('fullName');
          }}
          error={fieldErrors.fullName}
          leftIcon={<UserIcon size={20} color={colors.textMuted} />}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!isSubmitting}
          containerClassName="mb-3"
        />

        <GenieInput
          ref={emailRef}
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
          returnKeyType="next"
          onSubmitEditing={() => mobileRef.current?.focus()}
          editable={!isSubmitting}
          containerClassName="mb-3"
        />

        <GenieInput
          ref={mobileRef}
          label={t('auth:fields.mobile')}
          placeholder={t('auth:fields.mobilePlaceholder')}
          autoComplete="tel"
          value={mobile}
          onChangeText={value => {
            setMobile(value.replace(/\D/g, '').slice(0, 10));
            clearFieldError('mobile');
          }}
          error={fieldErrors.mobile}
          helperText={t('auth:fields.mobileHelper')}
          leftIcon={<PhoneIcon size={20} color={colors.textMuted} />}
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!isSubmitting}
          containerClassName="mb-3"
        />

        <RolePicker label={t('auth:fields.selectRole')} value={role} onChange={setRole} />

        <GeniePasswordInput
          ref={passwordRef}
          label={t('auth:fields.password')}
          placeholder={t('auth:fields.newPasswordPlaceholder')}
          autoComplete="new-password"
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
          label={t('auth:fields.confirmPassword')}
          placeholder={t('auth:fields.confirmPasswordPlaceholder')}
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={value => {
            setConfirmPassword(value);
            clearFieldError('confirmPassword');
          }}
          error={fieldErrors.confirmPassword}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!isSubmitting}
          containerClassName="mb-4"
        />

        <GenieButton
          label={t('auth:signup.submit')}
          loadingLabel={t('auth:signup.submitting')}
          loading={isSubmitting}
          onPress={handleSubmit}
        />
      </GenieForm>

      <GenieDivider className="my-4" />

      {/* Creates the account with the role chosen above (Google verifies the email). */}
      <GoogleButton role={role} onMessage={setFormError} disabled={isSubmitting} />

      <View className="my-6 flex-row items-center justify-center">
        <GenieText variant="body-sm" tone="secondary">
          {`${t('auth:signup.haveAccount')} `}
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
