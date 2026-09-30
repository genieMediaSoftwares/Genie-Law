import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DetailsStep } from '../DetailsStep';
import { initialPostCaseState } from '../../types';
import { voiceRecorder } from '../../../../../services/voiceRecorder';
import { aiApi } from '../../../../../api/aiApi';

jest.mock('../../../../../services/secureStorage', () =>
  require('../../../../../test-utils/memorySecureStorage'),
);
jest.mock('../../../../../services/voiceRecorder', () => ({
  voiceRecorder: {
    isSupported: true,
    requestPermission: jest.fn(),
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => ({ uri: 'file:///cache/v.m4a', name: 'genie-voice-note.m4a', type: 'audio/m4a', size: null })),
    cancel: jest.fn(async () => undefined),
  },
}));

const recorder = voiceRecorder as jest.Mocked<typeof voiceRecorder>;

const renderStep = (onChange = jest.fn()) =>
  render(
    <DetailsStep
      state={{ ...initialPostCaseState, description: 'Wall built on our land.' }}
      onChange={onChange}
      onFieldEdited={jest.fn()}
    />,
  );

it('explains a denied microphone permission and does not record', async () => {
  recorder.requestPermission.mockResolvedValueOnce(false);
  await renderStep();

  await fireEvent.press(screen.getByLabelText('Dictate your description'));

  expect(await screen.findByText('Microphone access is needed to dictate.')).toBeOnTheScreen();
  expect(recorder.start).not.toHaveBeenCalled();
});

it('asks again after a denial and records once allowed', async () => {
  recorder.requestPermission.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await renderStep();

  await fireEvent.press(screen.getByLabelText('Dictate your description'));
  await fireEvent.press(screen.getByLabelText('Dictate your description'));

  expect(await screen.findByLabelText('Stop dictation')).toBeOnTheScreen();
  expect(screen.getByText('Listening — tap the microphone to finish.')).toBeOnTheScreen();
  expect(recorder.start).toHaveBeenCalledTimes(1);
});

it('transcribes on stop and appends the text to the description', async () => {
  recorder.requestPermission.mockResolvedValue(true);
  const transcribe = jest
    .spyOn(aiApi, 'transcribe')
    .mockResolvedValue({ transcript: 'The wall is two feet inside.', language: 'en' } as never);
  const onChange = jest.fn();
  await renderStep(onChange);

  await fireEvent.press(screen.getByLabelText('Dictate your description'));
  await fireEvent.press(await screen.findByLabelText('Stop dictation'));

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({
      description: 'Wall built on our land. The wall is two feet inside.',
    }),
  );
  expect(transcribe).toHaveBeenCalledTimes(1);
});

it('shows a transcription failure instead of fake text', async () => {
  recorder.requestPermission.mockResolvedValue(true);
  jest.spyOn(aiApi, 'transcribe').mockRejectedValue(new Error('Transcription service unavailable'));
  const onChange = jest.fn();
  await renderStep(onChange);

  await fireEvent.press(screen.getByLabelText('Dictate your description'));
  await fireEvent.press(await screen.findByLabelText('Stop dictation'));

  expect(await screen.findByText('Transcription service unavailable')).toBeOnTheScreen();
  expect(onChange).not.toHaveBeenCalled();
});

it('releases the microphone when the step is left mid-recording', async () => {
  recorder.requestPermission.mockResolvedValue(true);
  const { unmount } = await renderStep();
  await fireEvent.press(screen.getByLabelText('Dictate your description'));
  await screen.findByLabelText('Stop dictation');

  await unmount();

  expect(recorder.cancel).toHaveBeenCalledTimes(1);
});

it('does not touch the recorder on unmount when not recording', async () => {
  const { unmount } = await renderStep();
  await unmount();
  expect(recorder.cancel).not.toHaveBeenCalled();
});
