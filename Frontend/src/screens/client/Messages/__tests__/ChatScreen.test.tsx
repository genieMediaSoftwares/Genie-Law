import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { requests, resetHttpStub, setHttpHandler } from '../../../../test-utils/httpStub';
import { messageFixture, ok, userFixture } from '../../../../test-utils/fixtures';
import { createTestQueryClient, navigationStub, renderWithClient } from '../../../../test-utils/render';
import { fakeSocketFor, fakeSockets } from '../../../../test-utils/fakeSocketIo';
import { startRealtimeSession } from '../../../../realtime/realtimeSession';
import { useAuthStore } from '../../../../store/authStore';
import type { ChatMessage } from '../../../../types/domain';
import { ChatScreen } from '../ChatScreen';

jest.mock('../../../../services/secureStorage', () =>
  require('../../../../test-utils/memorySecureStorage'),
);
jest.mock('socket.io-client', () => require('../../../../test-utils/fakeSocketIo'));

const CHAT_ID = '6653a0b1c2d3e4f506172839';
const me = userFixture();
const lawyer = userFixture({ _id: '6650f0c2a1b2c3d4e5f60799', fullName: 'Adv. Ravi Kumar' });
let serverMessages: ChatMessage[];

beforeEach(() => {
  resetHttpStub();
  fakeSockets.length = 0;
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: me._id, fullName: me.fullName, email: me.email, mobile: me.mobile, role: 'client', profileImage: '', location: '' },
  });
  serverMessages = [
    messageFixture({ _id: 'm1', sender: lawyer, content: 'Please share the sale deed.' }),
    messageFixture({ _id: 'm2', sender: me, content: 'Uploading it now.' }),
  ];
  setHttpHandler(config => {
    if (config.url === `/chats/${CHAT_ID}/messages` && config.method === 'get') return ok(serverMessages);
    if (config.url === `/chats/${CHAT_ID}/messages` && config.method === 'post') {
      const sent = messageFixture({ _id: `m${serverMessages.length + 1}`, sender: me, content: JSON.parse(config.data).content });
      serverMessages = [...serverMessages, sent];
      return { status: 201, data: { success: true, message: 'Sent', data: sent } };
    }
    if (config.url === `/chats/${CHAT_ID}/read`) return ok(null);
    if (config.url === '/chats') return ok([]);
    return { status: 404 };
  });
});

afterEach(() => useAuthStore.setState({ status: 'unauthenticated', user: null }));

const renderScreen = (client = createTestQueryClient()) =>
  renderWithClient(
    <ChatScreen
      navigation={navigationStub() as never}
      route={{ key: 'Chat', name: 'Chat', params: { chatId: CHAT_ID, name: 'Adv. Ravi Kumar' } } as never}
    />,
    client,
  );

it('renders both sides of the conversation from the backend', async () => {
  await renderScreen();
  expect(await screen.findByText('Please share the sale deed.')).toBeOnTheScreen();
  expect(screen.getByText('Uploading it now.')).toBeOnTheScreen();
  expect(requests.some(r => r.url === `/chats/${CHAT_ID}/read`)).toBe(true);
});

it('sends a message once, even on a double tap, and shows the saved message', async () => {
  await renderScreen();
  await screen.findByText('Please share the sale deed.');

  await fireEvent.changeText(screen.getByPlaceholderText('Type a message...'), 'Sent the deed.');
  const send = screen.getByLabelText('Send message');
  await fireEvent.press(send);
  await fireEvent.press(send);

  expect(await screen.findByText('Sent the deed.')).toBeOnTheScreen();
  expect(requests.filter(r => r.method === 'post')).toHaveLength(1);
});

it('refreshes the open conversation on a chat_updated push, without duplicating it', async () => {
  const client = createTestQueryClient();
  const stop = startRealtimeSession(client);
  try {
    await renderScreen(client);
    await screen.findByText('Please share the sale deed.');
    act(() => fakeSocketFor('chat').serverConnects());

    serverMessages = [
      ...serverMessages,
      messageFixture({ _id: 'm3', sender: lawyer, content: 'Received, thank you.', createdAt: '2026-09-29T12:05:00.000Z' }),
    ];
    const update = { chatId: CHAT_ID, lastMessage: 'Received, thank you.', lastMessageAt: '2026-09-29T12:05:00.000Z', senderId: lawyer._id };
    await act(async () => {
      fakeSocketFor('chat').fire('chat_updated', update);
      fakeSocketFor('chat').fire('chat_updated', update);
    });

    expect(await screen.findByText('Received, thank you.')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByText('Received, thank you.')).toHaveLength(1));
    expect(screen.getAllByText('Please share the sale deed.')).toHaveLength(1);
  } finally {
    stop();
  }
});
