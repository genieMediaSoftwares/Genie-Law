import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { GenieText } from './ui';
import { GoogleIcon } from './icons/Icons';
import { colors } from '../theme';
import { authApi } from '../api/authApi';
import { signInWithGoogle } from '../services/googleSignIn';
import { useAuthStore } from '../store/authStore';
import { toAppError } from '../utils/errors';
import type { SignupRole } from '../types/auth';
import { useT } from '../i18n/useT';

interface GoogleButtonProps {
  // Role for a NEW account. An existing account always keeps its own role.
  role: SignupRole;
  // Shows a message on the screen (cancelled, failed, not configured, ...).
  onMessage: (message: string) => void;
  disabled?: boolean;
}

export const GoogleButton: React.FC<GoogleButtonProps> = ({ role, onMessage, disabled = false }) => {
  const { t } = useT();
  const completeSession = useAuthStore(state => state.completeSession);
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const { google } = await authApi.providers();
      if (!google) {
        onMessage(t('common:errorCodes.GOOGLE_NOT_CONFIGURED'));
        return;
      }
      const outcome = await signInWithGoogle(role);
      if (outcome.kind === 'session') {
        await completeSession(outcome.session);
      } else if (outcome.kind === 'cancelled') {
        onMessage(t('auth:google.cancelled'));
      } else if (outcome.kind === 'failed') {
        onMessage(outcome.message);
      }
      // 'redirecting' (web): the browser is leaving for Google.
    } catch (error) {
      onMessage(toAppError(error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={t('auth:google.continue')}
      accessibilityState={{ busy, disabled: disabled || busy }}
      className="h-control items-center justify-center rounded-control border border-border bg-surface active:bg-input"
    >
      <View className="flex-row items-center">
        {busy ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : (
          <GoogleIcon size={20} color={colors.textSecondary} />
        )}
        <GenieText variant="label" tone="secondary" className="ml-3 text-base">
          {t('auth:google.continue')}
        </GenieText>
      </View>
    </Pressable>
  );
};
