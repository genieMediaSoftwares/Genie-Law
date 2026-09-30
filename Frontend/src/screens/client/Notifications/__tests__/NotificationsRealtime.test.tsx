import React from 'react';
import { act, screen } from '@testing-library/react-native';

import { requests, resetHttpStub, setHttpHandler } from '../../../../test-utils/httpStub';
import { notificationFixture, notificationPageFixture, ok } from '../../../../test-utils/fixtures';
import { createTestQueryClient, navigationStub, renderWithClient } from '../../../../test-utils/render';
import { fakeSocketFor, fakeSockets } from '../../../../test-utils/fakeSocketIo';
import { useRealtimeStatus, startRealtimeSession } from '../../../../realtime/realtimeSession';
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

it('shows a notification pushed over Socket.IO, once, from the backend list', async () => {
  const client = createTestQueryClient();
  useAuthStore.setState({ status: 'authenticated' });
  const stop = startRealtimeSession(client);
  try {
    await renderScreen(client);
    await screen.findByText('Advocate accepted your case');
    act(() => fakeSocketFor('notifications').serverConnects());

    const pushed = notificationFixture({
      _id: '6652b1c2d3e4f50617283999',
      title: 'New message from Adv. Ravi Kumar',
      type: 'chat_message',
    });
    serverNotifications = [pushed, ...serverNotifications];
    const before = requests.length;

    await act(async () => {
      fakeSocketFor('notifications').fire('new_notification', pushed);
      fakeSocketFor('notifications').fire('new_notification', pushed); // redelivered
    });

    expect(await screen.findByText('New message from Adv. Ravi Kumar')).toBeOnTheScreen();
    expect(screen.getAllByText('New message from Adv. Ravi Kumar')).toHaveLength(1);
    expect(requests.length - before).toBe(1);
  } finally {
    // Cancel any in-flight queries and clear the client before tearing
    // down the socket so React Query cannot schedule a late refetch.
    client.cancelQueries();
    client.clear();
    stop();
    useAuthStore.setState({ status: 'unauthenticated', user: null });
  }
});

