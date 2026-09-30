import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { requests, resetHttpStub, setHttpHandler } from '../../../../test-utils/httpStub';
import {
  caseFixture,
  categoriesFixture,
  notificationPageFixture,
  ok,
} from '../../../../test-utils/fixtures';
import { navigationStub, renderWithClient } from '../../../../test-utils/render';
import { loadLegalCategories } from '../../../../services/legalCategories';
import { MyCasesScreen } from '../MyCasesScreen';

jest.mock('../../../../services/secureStorage', () =>
  require('../../../../test-utils/memorySecureStorage'),
);

type Reply = { status: number; data?: unknown } | Promise<{ status: number; data?: unknown }>;
let casesReply: () => Reply;

beforeAll(async () => {
  setHttpHandler(() => ok(categoriesFixture));
  await loadLegalCategories();
});

beforeEach(() => {
  resetHttpStub();
  setHttpHandler(config => {
    if (config.url === '/cases') return casesReply();
    if (config.url === '/notifications') return ok(notificationPageFixture([]));
    return { status: 404 };
  });
});

const renderScreen = () => {
  const navigation = navigationStub();
  return renderWithClient(
    <MyCasesScreen navigation={navigation as never} route={{ key: 'Cases', name: 'Cases' } as never} />,
  ).then(result => ({ ...result, navigation }));
};

it('shows loading placeholders while the backend responds', async () => {
  casesReply = () => new Promise(() => undefined);
  await renderScreen();
  expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  expect(screen.queryByText('No legal cases posted')).toBeNull();
});

it('renders the cases the backend returned, with tab counts', async () => {
  casesReply = () =>
    ok([
      caseFixture(),
      caseFixture({
        _id: '6651a3b4c5d6e7f809112299',
        title: 'Mutual divorce filing',
        category: 'Family & Divorce',
        status: 'Completed',
      }),
    ]);
  const { navigation } = await renderScreen();

  expect(await screen.findByText('Boundary wall dispute with neighbour')).toBeOnTheScreen();
  expect(screen.getByText('Mutual divorce filing')).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: /All\D*2/ })).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: /Closed\D*1/ })).toBeOnTheScreen();

  await fireEvent.press(screen.getByText('Boundary wall dispute with neighbour'));
  expect(navigation.navigate).toHaveBeenCalledWith('CaseDetails', {
    caseId: '6651a3b4c5d6e7f809112233',
  });
});

it('filters to closed cases on the Closed tab', async () => {
  casesReply = () =>
    ok([caseFixture(), caseFixture({ _id: 'c2', title: 'Mutual divorce filing', status: 'Closed' })]);
  await renderScreen();
  await screen.findByText('Boundary wall dispute with neighbour');

  await fireEvent.press(screen.getByRole('tab', { name: /Closed/ }));

  await waitFor(() => expect(screen.queryByText('Boundary wall dispute with neighbour')).toBeNull());
  expect(screen.getByText('Mutual divorce filing')).toBeOnTheScreen();
});

it('shows the empty state when the backend has no cases', async () => {
  casesReply = () => ok([]);
  await renderScreen();
  expect(await screen.findByText('No legal cases posted')).toBeOnTheScreen();
  expect(screen.getByText('Post Your First Case')).toBeOnTheScreen();
});

it('shows a readable, translated error and retries on request', async () => {
  let attempts = 0;
  casesReply = () => {
    attempts += 1;
    return attempts === 1
      ? { status: 500, data: { success: false, message: 'E11000 duplicate key' } }
      : ok([caseFixture()]);
  };
  await renderScreen();

  expect(await screen.findByText('The server ran into a problem. Please try again.')).toBeOnTheScreen();
  expect(screen.queryByText(/status code|E11000/)).toBeNull();

  await fireEvent.press(screen.getByText('Try again'));

  expect(await screen.findByText('Boundary wall dispute with neighbour')).toBeOnTheScreen();
  expect(requests.filter(r => r.url === '/cases')).toHaveLength(2);
});
