import React from 'react';
import { screen } from '@testing-library/react-native';

import { requests, resetHttpStub, setHttpHandler } from '../../../../test-utils/httpStub';
import { notificationFixture, notificationPageFixture, ok } from '../../../../test-utils/fixtures';
import { createTestQueryClient, navigationStub, renderWithClient } from '../../../../test-utils/render';
import { fakeSockets } from '../../../../test-utils/fakeSocketIo';
import { useRealtimeStatus } from '../../../../realtime/realtimeSession';
import { useAuthStore } from '../../../../store/authStore';
import type { AppNotification } from '../../../../types/domain';
import { NotificationsScreen } from '../NotificationsScreen';

jest.mock('../../../../services/secureStorage', () =>
  require('../../../../test-utils/memorySecureStorage'),
);
jest.mock('socket.io-client', () => require('../../../../test-utils/fakeSocketIo'));

let serverNotifications: AppNotification[];

beforeEach(() => {
  resetHttpStub();
  fakeSockets.length = 0;
  useRealtimeStatus.setState({ live: { notifications: false, cases: false, chat: false } });
  useAuthStore.setState({ status: 'unauthenticated', user: null });
  serverNotifications = [
    notificationFixture(),
    notificationFixture({
      _id: '6652b1c2d3e4f50617283941',
      title: 'Hearing scheduled',
      message: 'Next hearing on 3 October.',
      type: 'hearing_scheduled',
      isRead: true,
    }),
  ];
  setHttpHandler(config =>
    config.url === '/notifications'
      ? ok(notificationPageFixture(serverNotifications))
      : { status: 404 },
  );
});

const renderScreen = (client = createTestQueryClient()) =>
  renderWithClient(
    <NotificationsScreen
      navigation={navigationStub() as never}
      route={{ key: 'Notifications', name: 'Notifications' } as never}
    />,
    client,
  );

it('renders the notifications the backend returned', async () => {
  await renderScreen();
  expect(await screen.findByText('Advocate accepted your case')).toBeOnTheScreen();
  expect(screen.getByText('Hearing scheduled')).toBeOnTheScreen();
  expect(requests[0].params).toEqual({ page: '1', limit: expect.any(String) });
});

it('tells screen readers which notifications are unread', async () => {
  await renderScreen();
  await screen.findByText('Advocate accepted your case');
  expect(screen.getByLabelText(/^Unread, Advocate accepted your case/)).toBeOnTheScreen();
  expect(screen.getByLabelText(/^Hearing scheduled/)).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Unread, Hearing scheduled/)).toBeNull();
});

it('shows a readable error when the list cannot load', async () => {
  setHttpHandler(() => ({ networkError: 'ERR_NETWORK' }));
  const client = createTestQueryClient();
  await renderScreen(client);
  const errorText = await screen.findByText(/No internet/, {}, { timeout: 10000 });
  expect(errorText).toBeOnTheScreen();
});
