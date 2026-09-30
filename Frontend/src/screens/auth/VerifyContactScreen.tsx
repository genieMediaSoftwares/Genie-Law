import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  GenieButton,
  GenieInput,
  GenieNotice,
  GenieScreen,
  GenieText,
  Logo,
} from '../../components';
import { MailIcon, PhoneIcon } from '../../components/icons/Icons';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../store/authStore';
import { toAppError } from '../../utils/errors';
import type { OtpChannel, OtpSent } from '../../types/auth';
import type { AuthScreenProps } from '../../types/navigation';
import { colors } from '../../theme';
import { useT } from '../../i18n/useT';

// Verify ONE contact (email or mobile) with a code from the backend. On
// success the backend opens a normal session and the user is signed in.
export const VerifyContactScreen: React.FC<AuthScreenProps<'VerifyContact'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const { verificationToken, channels, email } = route.params;
  const completeSession = useAuthStore(state => state.completeSession);

  const available = useMemo(
    () => (['email', 'mobile'] as OtpChannel[]).filter(c => channels[c] && !channels[c]!.verified),
    [channels],
  );
  const [channel, setChannel] = useState<OtpChannel>(available[0] ?? 'email');
  const [sent, setSent] = useState<OtpSent | null>(null);
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // The verification token expired: start over from sign-in.
  const handleFailure = useCallback(
    (failure: unknown) => {
      const info = toAppError(failure);
      if (info.code === 'VERIFICATION_SESSION_EXPIRED') {
        navigation.replace('Login');
        return;
      }
      if (info.code === 'OTP_RESEND_COOLDOWN' && typeof info.data?.retryAfterSeconds === 'number') {
        setResendIn(info.data.retryAfterSeconds);
      }
      if (info.code === 'OTP_INVALID' && typeof info.data?.attemptsRemaining === 'number') {
        const left = info.data.attemptsRemaining;
        setError(t('auth:otp.incorrectWithAttempts', { count: left }));
        return;
      }
      if (info.code === 'OTP_EXPIRED' || info.code === 'OTP_TOO_MANY_ATTEMPTS' || info.code === 'OTP_NOT_FOUND') {
        setCode('');
        setResendIn(0);
      }
      setError(info.message);
    },
    [navigation, t],
  );

  const sendCode = useCallback(async () => {
    if (isSending) {
      return;
    }
    setIsSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await authApi.requestOtp(verificationToken, channel);
      setSent(result);
      setCode('');
      setResendIn(result.resendAfterSeconds);
      setNotice(
        t('auth:otp.sent', {
          destination: result.destination,
          count: Math.round(result.expiresInSeconds / 60),
        }),
      );
    } catch (failure) {
      handleFailure(failure);
    } finally {
      setIsSending(false);
    }
  }, [channel, handleFailure, isSending, t, verificationToken]);

  const verify = useCallback(async () => {
    if (isVerifying) {
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t('auth:otp.enterCode'));
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const session = await authApi.verifyOtp({ verificationToken, channel, code: code.trim() });
      await completeSession(session);
    } catch (failure) {
      handleFailure(failure);
    } finally {
      setIsVerifying(false);
    }
  }, [channel, code, completeSession, handleFailure, isVerifying, t, verificationToken]);

  if (available.length === 0) {
    return (
      <GenieScreen scrollable>
        <GenieNotice message={t('auth:otp.alreadyVerified')} tone="gold" className="mt-10 mb-4" />
        <GenieButton label={t('auth:otp.goToLogin')} onPress={() => navigation.replace('Login')} />
      </GenieScreen>
    );
  }

  return (
    <GenieScreen scrollable>
      <View className="my-6 items-center">
        <Logo size={64} />
        <GenieText variant="heading-md" className="mt-3">
          {t('auth:otp.title')}
        </GenieText>
        <GenieText variant="body" tone="secondary" className="mt-1 text-center">
          {t('auth:otp.subtitle', { email })}
        </GenieText>
      </View>

      <GenieNotice message={error} className="mb-3" />
      <GenieNotice message={notice} tone="gold" className="mb-3" />

      {!sent ? (
        <>
          <GenieText variant="label" tone="secondary" className="mb-2">
            {t('auth:otp.sendTo')}
          </GenieText>
          {available.map(option => {
            const selected = option === channel;
            const Icon = option === 'email' ? MailIcon : PhoneIcon;
            return (
              <Pressable
                key={option}
                onPress={() => setChannel(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`mb-3 flex-row items-center rounded-control border px-4 py-4 ${
                  selected ? 'border-gold bg-gold-muted' : 'border-border bg-surface'
                }`}
              >
                <Icon size={20} color={selected ? colors.gold : colors.textMuted} />
                <View className="ml-3 flex-1">
                  <GenieText variant="label">
                    {option === 'email' ? t('auth:fields.email') : t('auth:otp.mobileNumber')}
                  </GenieText>
                  <GenieText variant="caption" tone="secondary">
                    {channels[option]!.destination}
                  </GenieText>
                </View>
              </Pressable>
            );
          })}
          <GenieButton
            label={t('auth:otp.sendCode')}
            loadingLabel={t('common:actions.sending')}
            loading={isSending}
            onPress={sendCode}
            className="mt-2"
          />
        </>
      ) : (
        <>
          {sent.devCode ? (
            <View className="mb-4 rounded-card border border-warning bg-warning-surface p-3">
              <GenieText variant="caption" tone="warning" className="font-semibold">
                {t('auth:otp.devOnly')}
              </GenieText>
              <GenieText variant="body" tone="warning" className="mt-1">
                {t('auth:otp.devCode', { code: sent.devCode })}
              </GenieText>
            </View>
          ) : null}

          <GenieInput
            label={t('auth:otp.codeLabel')}
            placeholder={t('auth:otp.codePlaceholder')}
            value={code}
            onChangeText={value => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            leftIcon={channel === 'email' ? <MailIcon size={20} color={colors.textMuted} /> : <PhoneIcon size={20} color={colors.textMuted} />}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={verify}
            editable={!isVerifying}
            containerClassName="mb-4"
          />

          <GenieButton
            label={t('auth:otp.verify')}
            loadingLabel={t('auth:otp.verifying')}
            loading={isVerifying}
            onPress={verify}
          />

          <View className="mt-5 flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                setSent(null);
                setNotice(null);
                setError(null);
              }}
              hitSlop={8}
              accessibilityRole="button"
              className="active:opacity-70"
            >
              <GenieText variant="label" tone="secondary">
                {t('auth:otp.changeMethod')}
              </GenieText>
            </Pressable>
            <Pressable
              onPress={sendCode}
              disabled={resendIn > 0 || isSending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ disabled: resendIn > 0 || isSending }}
              className="active:opacity-70"
            >
              <GenieText variant="label" tone={resendIn > 0 ? 'muted' : 'gold'}>
                {resendIn > 0 ? t('auth:otp.resendIn', { seconds: resendIn }) : t('auth:otp.resend')}
              </GenieText>
            </Pressable>
          </View>
        </>
      )}

      <Pressable
        onPress={() => navigation.replace('Login')}
        hitSlop={8}
        accessibilityRole="button"
        className="mt-8 self-center active:opacity-70"
      >
        <GenieText variant="label" tone="secondary">
          {t('auth:otp.backToLogin')}
        </GenieText>
      </Pressable>
    </GenieScreen>
  );
};
