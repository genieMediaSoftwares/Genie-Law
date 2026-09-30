import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { InternalAxiosRequestConfig } from 'axios';

import { requests, resetHttpStub, setHttpHandler } from '../../../../test-utils/httpStub';
import type { StubReply } from '../../../../test-utils/httpStub';
import { navigationStub } from '../../../../test-utils/render';
import { ok } from '../../../../test-utils/fixtures';
import { filePicker } from '../../../../services/filePicker';
import { voiceRecorder } from '../../../../services/voiceRecorder';
import { caseDraftFiles } from '../../../../services/caseDraftFiles';
import type { AiAnalyzeAccepted, DocumentRelevanceResult, PickedFile } from '../../../../types/ai';
import { AiAssistantScreen } from '../AiAssistantScreen';

jest.mock('../../../../services/secureStorage', () =>
  require('../../../../test-utils/memorySecureStorage'),
);
// The device's file picker and microphone; everything else is the real code.
jest.mock('../../../../services/filePicker', () => ({
  filePicker: { pickDocuments: jest.fn(), pickImage: jest.fn(), maxFileBytes: 10 * 1024 * 1024 },
}));
jest.mock('../../../../services/voiceRecorder', () => ({
  voiceRecorder: {
    isSupported: true,
    requestPermission: jest.fn(async () => true),
    start: jest.fn(async () => undefined),
    stop: jest.fn(),
    cancel: jest.fn(async () => undefined),
  },
}));

const ANALYSE = 'Analyse & Generate Case with AI';
const BROWSE = 'Tap to browse and select documents';

const saleDeed: PickedFile = {
  uri: 'content://com.android.providers.downloads/document/77',
  name: 'Sale deed.pdf',
  type: 'application/pdf',
  size: 640_000,
};

const relevant: DocumentRelevanceResult = {
  accepted: true,
  relevant: true,
  confidence: 0.93,
  documentType: 'Sale Deed',
  reason: 'Registered sale deed for the disputed plot.',
  caseRelation: 'Proves ownership of the land in dispute.',
  verificationToken: 'rel-token-1',
};

const acceptedSession: AiAnalyzeAccepted = {
  sessionId: '6655aa00bb11cc22dd33ee44',
  status: 'processing' as AiAnalyzeAccepted['status'],
  progress: { stage: 'queued', percent: 0 } as unknown as AiAnalyzeAccepted['progress'],
  uploadedDocuments: [],
  documentCount: 1,
};

type AnalyzeHandler = (config: InternalAxiosRequestConfig) => StubReply | Promise<StubReply>;
let analyze: AnalyzeHandler;

// Standard FormData (Jest) exposes get(); React Native's keeps [name, value] pairs.
const formValue = (config: InternalAxiosRequestConfig, name: string): unknown => {
  const data = config.data as { get?: (key: string) => unknown; _parts?: [string, unknown][] };
  return data.get ? data.get(name) : (data._parts ?? []).find(([key]) => key === name)?.[1];
};

const analyzeCalls = () => requests.filter(r => r.url === '/ai/smart-case/analyze');

beforeEach(() => {
  resetHttpStub();
  (filePicker.pickDocuments as jest.Mock).mockResolvedValue([saleDeed]);
  analyze = () => ({ status: 202, data: { success: true, message: 'Analysis started.', data: acceptedSession } });
  setHttpHandler(config => {
    if (config.url === '/ai/documents/relevance') return ok(relevant);
    if (config.url === '/ai/smart-case/analyze') return analyze(config);
    return { status: 404 };
  });
});

const renderScreen = async () => {
  const navigation = navigationStub();
  const utils = await render(
    <AiAssistantScreen
      navigation={navigation as never}
      route={{ key: 'AiAssistant', name: 'AiAssistant' } as never}
    />,
  );
  return { ...utils, navigation };
};

const addSaleDeed = async () => {
  await fireEvent.press(screen.getByLabelText(BROWSE));
  expect(await screen.findByText('Sale deed.pdf')).toBeOnTheScreen();
};

it('starts with no documents and asks for one before analysing', async () => {
  await renderScreen();
  expect(screen.getByText('AI Smart Case Assistant')).toBeOnTheScreen();
  expect(screen.getByText('Add at least one document relevant to your case to continue.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: ANALYSE })).toBeDisabled();
});

it('adds a document only after the backend says it is relevant', async () => {
  await renderScreen();
  await addSaleDeed();
  expect(requests.filter(r => r.url === '/ai/documents/relevance')).toHaveLength(1);
  expect(screen.getByRole('button', { name: ANALYSE })).toBeEnabled();
});

it('does not add a document the backend finds irrelevant', async () => {
  setHttpHandler(config =>
    config.url === '/ai/documents/relevance'
      ? ok({ ...relevant, accepted: false, relevant: false, verificationToken: null, documentType: 'Restaurant bill', reason: 'Not related to a property dispute.' })
      : { status: 404 },
  );
  await renderScreen();
  await fireEvent.press(screen.getByLabelText(BROWSE));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(screen.queryByTestId('ai-document-status-0')).toBeNull();
  expect(screen.getByRole('button', { name: ANALYSE })).toBeDisabled();
});

it('analyses, stashes the documents and continues to Post Case with the session', async () => {
  const { navigation } = await renderScreen();
  await addSaleDeed();

  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));

  await waitFor(() =>
    expect(navigation.replace).toHaveBeenCalledWith('PostCase', { sessionId: acceptedSession.sessionId }),
  );
  expect(analyzeCalls()).toHaveLength(1);
  expect(formValue(analyzeCalls()[0], 'requestId')).toMatch(/^ai-/);
  expect(caseDraftFiles.take(acceptedSession.sessionId).map(f => f.name)).toEqual(['Sale deed.pdf']);
});

it('shows upload progress while the analysis request is in flight', async () => {
  let release!: () => void;
  analyze = () =>
    new Promise(resolve => {
      release = () => resolve({ status: 202, data: { success: true, message: 'ok', data: acceptedSession } });
    });
  await renderScreen();
  await addSaleDeed();

  const tap = fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  expect(await screen.findByText(/Uploading/)).toBeOnTheScreen();

  release();
  await tap;
});

it('shows a server failure, then succeeds on retry with a new request id', async () => {
  let attempt = 0;
  analyze = () => {
    attempt += 1;
    return attempt === 1
      ? { status: 500, data: { success: false, message: 'Analysis service error' } }
      : { status: 202, data: { success: true, message: 'ok', data: acceptedSession } };
  };
  const { navigation } = await renderScreen();
  await addSaleDeed();

  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  expect(await screen.findByText('Analysis service error')).toBeOnTheScreen();
  expect(navigation.replace).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
  const [first, second] = analyzeCalls();
  expect(formValue(first, 'requestId')).not.toEqual(formValue(second, 'requestId'));
});

it('keeps the request id after a network failure, so a retry cannot start a second analysis', async () => {
  let attempt = 0;
  analyze = () => {
    attempt += 1;
    return attempt === 1
      ? { networkError: 'ERR_NETWORK' }
      : { status: 202, data: { success: true, message: 'Analysis already started.', data: acceptedSession } };
  };
  await renderScreen();
  await addSaleDeed();

  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  expect(await screen.findByText('No internet connection. Check your network and try again.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  await waitFor(() => expect(analyzeCalls()).toHaveLength(2));
  const [first, second] = analyzeCalls();
  expect(formValue(second, 'requestId')).toEqual(formValue(first, 'requestId'));
});

it('reports a timeout clearly', async () => {
  analyze = () => ({ networkError: 'ECONNABORTED' });
  const { navigation } = await renderScreen();
  await addSaleDeed();
  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  expect(await screen.findByText('The server is taking too long to respond. Please try again.')).toBeOnTheScreen();
  expect(navigation.replace).not.toHaveBeenCalled();
});

it('never continues on a response without a session id', async () => {
  analyze = () => ({ status: 202, data: { success: true, message: 'ok', data: {} } });
  const { navigation } = await renderScreen();
  await addSaleDeed();
  await fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  expect(navigation.replace).not.toHaveBeenCalled();
});

it('goes back from the header', async () => {
  const { navigation } = await renderScreen();
  await fireEvent.press(screen.getByLabelText('Go back'));
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not navigate if the user left while the upload was running', async () => {
  let release!: () => void;
  analyze = () =>
    new Promise(resolve => {
      release = () => resolve({ status: 202, data: { success: true, message: 'ok', data: acceptedSession } });
    });
  const { navigation, unmount } = await renderScreen();
  await addSaleDeed();

  const tap = fireEvent.press(screen.getByRole('button', { name: ANALYSE }));
  await waitFor(() => expect(analyzeCalls()).toHaveLength(1));
  await unmount();
  await act(async () => {
    release();
    await tap;
  });

  expect(navigation.replace).not.toHaveBeenCalled();
});

it('releases the microphone when leaving mid-recording', async () => {
  const { unmount } = await renderScreen();
  await fireEvent.press(screen.getAllByRole('button').find(b =>
    /record|mic/i.test(String(b.props.accessibilityLabel ?? '')),
  )!);
  await waitFor(() => expect(voiceRecorder.start).toHaveBeenCalled());
  await unmount();
  expect(voiceRecorder.cancel).toHaveBeenCalled();
});

it('sends ONE request for a double tap', async () => {
  let release!: () => void;
  analyze = () =>
    new Promise(resolve => {
      release = () => resolve({ status: 202, data: { success: true, message: 'ok', data: acceptedSession } });
    });
  const { navigation } = await renderScreen();
  await addSaleDeed();

  const button = screen.getByRole('button', { name: ANALYSE });
  const taps = Promise.all([fireEvent.press(button), fireEvent.press(button), fireEvent.press(button)]);
  await waitFor(() => expect(analyzeCalls()).toHaveLength(1));

  release();
  await taps;
  expect(analyzeCalls()).toHaveLength(1);
  expect(navigation.replace).toHaveBeenCalledTimes(1);
});
