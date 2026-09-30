import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { VerifyContactScreen } from '../screens/auth/VerifyContactScreen';
import { colors } from '../theme';
import type { AuthStackParamList } from '../types/navigation';
import { screenLayout } from './screenLayout';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => (
  <Stack.Navigator
    screenLayout={screenLayout}
    initialRouteName="Login"
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="VerifyContact" component={VerifyContactScreen} />
  </Stack.Navigator>
);
