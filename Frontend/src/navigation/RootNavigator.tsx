import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';

import { AuthNavigator } from './AuthNavigator';
import { ClientNavigator } from './ClientNavigator';
import { LawyerNavigator } from './LawyerNavigator';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { useAuthStore } from '../store/authStore';
import { blurActiveElement } from '../utils/webFocus';
import { colors } from '../theme';

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: colors.gold,
    background: colors.background,
    card: colors.surface,
    text: colors.white,
    border: colors.border,
    notification: colors.gold,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

export const RootNavigator: React.FC = () => {
  const status = useAuthStore(state => state.status);
  const role = useAuthStore(state => state.user?.role);

  if (status === 'restoring') {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme} onStateChange={blurActiveElement}>
      {status !== 'authenticated' ? (
        <AuthNavigator />
      ) : role === 'lawyer' ? (
        <LawyerNavigator />
      ) : (
        <ClientNavigator />
      )}
    </NavigationContainer>
  );
};
