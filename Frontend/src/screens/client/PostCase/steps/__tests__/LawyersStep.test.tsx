import React, { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { requests, resetHttpStub, setHttpHandler } from '../../../../../test-utils/httpStub';
import type { StubReply } from '../../../../../test-utils/httpStub';
import { categoriesFixture, ok } from '../../../../../test-utils/fixtures';
import { renderWithClient } from '../../../../../test-utils/render';
import { loadLegalCategories } from '../../../../../services/legalCategories';
import { initialPostCaseState, REQUIRED_LAWYER_COUNT } from '../../types';
import type { PostCaseState } from '../../types';
import type { RecommendedLawyer } from '../../../../../types/domain';
import { LawyersStep } from '../LawyersStep';

jest.mock('../../../../../services/secureStorage', () =>
  require('../../../../../test-utils/memorySecureStorage'),
);

// GET /lawyers/recommend item, as backend/src/controllers returns it.
const lawyer = (n: number, overrides: Partial<RecommendedLawyer> = {}): RecommendedLawyer => ({
  lawyerId: `lp-${n}`,
  userId: `u-${n}`,
  fullName: `Adv. Lawyer ${n}`,
  profileImage: '',
  specialization: 'Property & Land',
  city: 'Hyderabad',
  district: 'Hyderabad',
  state: 'Telangana',
  location: 'Hyderabad, Telangana',
  experience: 8 + n,
  rating: 4.5,
  reviewCount: 12,
  consultationFee: 1500,
  languages: ['English', 'Telugu'],
  practiceAreas: ['Property & Land'],
  verified: true,
  onlineStatus: false,
  responseTime: 'Within 2 hours',
  matchPercentage: 90 - n,
  casesHandled: 120,
  winPercentage: 78,
  locationScore: 1,
  bio: '',
  education: 'LL.B.',
  barCouncilNumber: `TS/${1000 + n}/2015`,
  officeAddress: '',
  workingHours: '',
  ...overrides,
});

let reply: () => StubReply | Promise<StubReply>;
let latest: PostCaseState;
const onViewProfile = jest.fn();

beforeAll(async () => {
  setHttpHandler(() => ok(categoriesFixture));
  await loadLegalCategories();
});

beforeEach(() => {
  resetHttpStub();
  reply = () => ok([1, 2, 3, 4].map(n => lawyer(n)));
  setHttpHandler(config => (config.url === '/lawyers/recommend' ? reply() : { status: 404 }));
});

// The Post Case screen owns the state; this harness plays that role.
const Harness: React.FC<{ initial: Partial<PostCaseState> }> = ({ initial }) => {
  const [state, setState] = useState<PostCaseState>({
    ...initialPostCaseState,
    category: 'Property & Land',
    subcategory: 'Land Dispute',
    location: 'Hyderabad',
    ...initial,
  });
  latest = state;
  return (
    <LawyersStep
      state={state}
      onChange={patch => setState(current => ({ ...current, ...patch }))}
      onViewProfile={onViewProfile}
    />
  );
};

const renderStep = (initial: Partial<PostCaseState> = {}) => renderWithClient(<Harness initial={initial} />);
const card = (n: number) => screen.getByTestId(`lawyer-card-u-${n}`);

it('asks the backend for lawyers matching the case, bounded by a limit', async () => {
  await renderStep();
  expect(await screen.findByText('Adv. Lawyer 1')).toBeOnTheScreen();
  expect(screen.getByText('Adv. Lawyer 4')).toBeOnTheScreen();
  expect(requests[0].params).toMatchObject({
    category: 'Property & Land',
    subcategory: 'Land Dispute',
    city: 'Hyderabad',
    limit: '20',
  });
});

it('shows loading placeholders, then the list', async () => {
  let release!: () => void;
  reply = () => new Promise(resolve => (release = () => resolve(ok([lawyer(1)]))));
  await renderStep();
  expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  release();
  expect(await screen.findByText('Adv. Lawyer 1')).toBeOnTheScreen();
});

it('shows a readable error and retries', async () => {
  let attempts = 0;
  reply = () => {
    attempts += 1;
    return attempts === 1 ? { status: 503 } : ok([lawyer(1)]);
  };
  await renderStep();
  expect(
    await screen.findByText('The service is temporarily unavailable. Please try again shortly.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Adv. Lawyer 1')).toBeOnTheScreen();
});

it('explains when nobody matches', async () => {
  reply = () => ok([]);
  await renderStep();
  expect(await screen.findByText('No lawyers matched yet')).toBeOnTheScreen();
});

it('warns when fewer lawyers than required match', async () => {
  reply = () => ok([lawyer(1)]);
  await renderStep();
  expect(await screen.findByText(/Only 1 lawyer matches this matter/)).toBeOnTheScreen();
});

it('selects and deselects, counting toward the required number', async () => {
  await renderStep();
  await screen.findByText('Adv. Lawyer 1');
  expect(screen.getByText(`0 / ${REQUIRED_LAWYER_COUNT} selected`)).toBeOnTheScreen();

  await fireEvent.press(card(1));
  expect(screen.getByText(`1 / ${REQUIRED_LAWYER_COUNT} selected`)).toBeOnTheScreen();
  expect(card(1)).toBeChecked();
  expect(screen.getByText('Select 2 more lawyers to continue.')).toBeOnTheScreen();

  await fireEvent.press(card(1));
  expect(card(1)).not.toBeChecked();
  expect(latest.selectedLawyers).toEqual([]);
});

it('never selects the same lawyer twice', async () => {
  await renderStep();
  await screen.findByText('Adv. Lawyer 1');
  await fireEvent.press(card(2));
  await fireEvent.press(screen.getByLabelText(/^Deselect Adv. Lawyer 2/));
  await fireEvent.press(card(2));
  expect(latest.selectedLawyers.map(l => l.userId)).toEqual(['u-2']);
});

it('stops at the required count and locks the rest', async () => {
  await renderStep();
  await screen.findByText('Adv. Lawyer 1');
  for (const n of [1, 2, 3]) {
    await fireEvent.press(card(n));
  }
  expect(latest.selectedLawyers.map(l => l.userId)).toEqual(['u-1', 'u-2', 'u-3']);
  expect(card(4)).toBeDisabled();
  expect(screen.getByText('Limit reached')).toBeOnTheScreen();

  await fireEvent.press(screen.getByText('Limit reached'));
  expect(latest.selectedLawyers).toHaveLength(REQUIRED_LAWYER_COUNT);
});

it('opens a lawyer profile', async () => {
  await renderStep();
  await screen.findByText('Adv. Lawyer 1');
  await fireEvent.press(screen.getAllByText('View Profile')[0]);
  expect(onViewProfile).toHaveBeenCalledWith('u-1', 'Adv. Lawyer 1');
});

it('refetches when the sort changes, with the sort sent to the backend', async () => {
  await renderStep();
  await screen.findByText('Adv. Lawyer 1');
  await fireEvent.press(screen.getByText('Rating'));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].params).toMatchObject({ sortBy: 'Rating' });
});
