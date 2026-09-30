import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { requests, resetHttpStub, setHttpHandler } from '../../../../test-utils/httpStub';
import { ok } from '../../../../test-utils/fixtures';
import { navigationStub, renderWithClient } from '../../../../test-utils/render';
import type { LawyerClientRow, LawyerNote } from '../../../../types/lawyer';
import { NotesScreen } from '../NotesScreen';

jest.mock('../../../../services/secureStorage', () =>
  require('../../../../test-utils/memorySecureStorage'),
);

const row = (n: number): LawyerClientRow => ({
  clientId: `client-${n}`,
  name: `Client ${n}`,
  profileImage: '',
  caseId: `case-${n}`,
  issue: `Matter ${n}`,
  currentStatus: 'Accepted',
  lastActivity: '2026-09-29T10:00:00.000Z',
});

const note = (clientN: number, title: string): LawyerNote => ({
  _id: `note-${clientN}-${title}`,
  title,
  text: `Notes for client ${clientN}`,
  case: null,
  lawyer: 'lawyer-1',
  date: '2026-09-29T10:00:00.000Z',
  updatedAt: '2026-09-29T10:00:00.000Z',
});

// A lawyer with many clients: the case the old screen turned into a storm.
const CLIENTS = Array.from({ length: 40 }, (_, i) => row(i + 1));

beforeEach(() => {
  resetHttpStub();
  setHttpHandler(config => {
    if (config.url === '/lawyers/clients') {
      return ok({ accepted: CLIENTS, inProgress: [], closed: [] });
    }
    const match = /^\/clients\/client-(\d+)\/notes$/.exec(config.url ?? '');
    if (match) return ok([note(Number(match[1]), `Hearing prep ${match[1]}`)]);
    return { status: 404 };
  });
});

const notesRequests = () => requests.filter(r => /\/notes$/.test(r.url ?? ''));

const renderScreen = () =>
  renderWithClient(
    <NotesScreen navigation={navigationStub() as never} route={{ key: 'Notes', name: 'Notes' } as never} />,
  );

it('loads notes for one client, not one request per client', async () => {
  await renderScreen();
  expect(await screen.findByText('Hearing prep 1')).toBeOnTheScreen();
  expect(notesRequests()).toHaveLength(1);
  expect(notesRequests()[0].url).toBe('/clients/client-1/notes');
});

it("loads another client's notes only when that client is opened", async () => {
  await renderScreen();
  await screen.findByText('Hearing prep 1');

  await fireEvent.press(screen.getByRole('tab', { name: 'Client 2' }));

  expect(await screen.findByText('Hearing prep 2')).toBeOnTheScreen();
  expect(screen.queryByText('Hearing prep 1')).toBeNull();
  await waitFor(() => expect(notesRequests()).toHaveLength(2));
  expect(screen.getByRole('tab', { name: 'Client 2' })).toBeSelected();
});

it('shows a readable error for the notes and retries', async () => {
  let failed = false;
  setHttpHandler(config => {
    if (config.url === '/lawyers/clients') return ok({ accepted: CLIENTS.slice(0, 2), inProgress: [], closed: [] });
    if (!failed) {
      failed = true;
      return { status: 500 };
    }
    return ok([note(1, 'Recovered note')]);
  });
  await renderScreen();
  expect(await screen.findByText('The server ran into a problem. Please try again.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Recovered note')).toBeOnTheScreen();
});
