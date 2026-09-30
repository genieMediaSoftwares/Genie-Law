import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { RootNavigator } from '../RootNavigator';
import { useAuthStore } from '../../store/authStore';
import type { AuthUser } from '../../types/auth';

// The three navigators are replaced by markers: this test is about which one
// the root mounts for each session state, not about their screens.
jest.mock('../AuthNavigator', () => ({
  AuthNavigator: () => require('react').createElement(require('react-native').Text, null, 'AUTH_STACK'),
}));
jest.mock('../ClientNavigator', () => ({
  ClientNavigator: () => require('react').createElement(require('react-native').Text, null, 'CLIENT_STACK'),
}));
jest.mock('../LawyerNavigator', () => ({
  LawyerNavigator: () => require('react').createElement(require('react-native').Text, null, 'LAWYER_STACK'),
}));
jest.mock('../../screens/auth/SplashScreen', () => ({
  SplashScreen: () => require('react').createElement(require('react-native').Text, null, 'SPLASH'),
}));

const user = (role: AuthUser['role']): AuthUser => ({
  id: '6650f0c2a1b2c3d4e5f60718',
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  mobile: '9876543210',
  role,
  profileImage: '',
  location: '',
});

const setSession = async (
  status: 'restoring' | 'authenticated' | 'unauthenticated',
  role?: AuthUser['role'],
) =>
  act(async () => {
    useAuthStore.setState({ status, user: role ? user(role) : null });
  });

it('shows the splash while the session is being restored', async () => {
  await setSession('restoring');
  await render(<RootNavigator />);
  expect(screen.getByText('SPLASH')).toBeOnTheScreen();
});

it('mounts only the auth stack when signed out', async () => {
  await setSession('unauthenticated');
  await render(<RootNavigator />);
  expect(screen.getByText('AUTH_STACK')).toBeOnTheScreen();
  expect(screen.queryByText('CLIENT_STACK')).toBeNull();
});

it('routes a signed-in client and lawyer to their own app', async () => {
  await setSession('authenticated', 'client');
  const { unmount } = await render(<RootNavigator />);
  expect(screen.getByText('CLIENT_STACK')).toBeOnTheScreen();
  await unmount();

  await setSession('authenticated', 'lawyer');
  await render(<RootNavigator />);
  expect(screen.getByText('LAWYER_STACK')).toBeOnTheScreen();
});

it('replaces the protected app with the auth stack on logout (no route back)', async () => {
  await setSession('authenticated', 'client');
  await render(<RootNavigator />);
  expect(screen.getByText('CLIENT_STACK')).toBeOnTheScreen();

  await setSession('unauthenticated');

  expect(screen.getByText('AUTH_STACK')).toBeOnTheScreen();
  expect(screen.queryByText('CLIENT_STACK')).toBeNull();
});
