import {
  AudioModule,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { voiceRecorder } from '../voiceRecorder';

// A recorder the way expo-audio exposes one; each test decides how it behaves.
const makeRecorder = (overrides: Partial<Record<string, unknown>> = {}) => ({
  prepareToRecordAsync: jest.fn(async () => undefined),
  record: jest.fn(),
  stop: jest.fn(async () => undefined),
  release: jest.fn(),
  currentTime: 0,
  uri: '/data/user/0/app/cache/recording-1.m4a',
  ...overrides,
});

const Recorder = AudioModule.AudioRecorder as unknown as jest.Mock;
const setMode = setAudioModeAsync as jest.Mock;

afterEach(async () => {
  await voiceRecorder.cancel();
});

it('reports a denied microphone permission', async () => {
  (requestRecordingPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  await expect(voiceRecorder.requestPermission()).resolves.toBe(false);
});

it('records and returns an m4a file the backend accepts', async () => {
  const recorder = makeRecorder();
  Recorder.mockImplementationOnce(() => recorder);

  await voiceRecorder.start(() => undefined);
  const file = await voiceRecorder.stop();

  expect(recorder.record).toHaveBeenCalled();
  expect(file).toEqual({
    uri: 'file:///data/user/0/app/cache/recording-1.m4a',
    name: 'genie-voice-note.m4a',
    type: 'audio/m4a',
    size: null,
  });
  expect(recorder.release).toHaveBeenCalled();
  expect(setMode).toHaveBeenLastCalledWith({ allowsRecording: false });
});

it('releases the microphone when recording fails to start', async () => {
  const recorder = makeRecorder({
    prepareToRecordAsync: jest.fn(async () => {
      throw new Error('Microphone busy');
    }),
  });
  Recorder.mockImplementationOnce(() => recorder);

  await expect(voiceRecorder.start(() => undefined)).rejects.toThrow('Microphone busy');

  expect(recorder.release).toHaveBeenCalled();
  expect(setMode).toHaveBeenLastCalledWith({ allowsRecording: false });
  await expect(voiceRecorder.stop()).rejects.toThrow(); // nothing left running
});

it('cancel stops and releases an active recording', async () => {
  const recorder = makeRecorder();
  Recorder.mockImplementationOnce(() => recorder);
  await voiceRecorder.start(() => undefined);

  await voiceRecorder.cancel();

  expect(recorder.stop).toHaveBeenCalled();
  expect(recorder.release).toHaveBeenCalled();
});

it('never keeps two sessions: a second start releases the first', async () => {
  const first = makeRecorder();
  const second = makeRecorder({ uri: '/cache/recording-2.m4a' });
  Recorder.mockImplementationOnce(() => first).mockImplementationOnce(() => second);

  await voiceRecorder.start(() => undefined);
  await voiceRecorder.start(() => undefined);

  expect(first.release).toHaveBeenCalled();
  expect((await voiceRecorder.stop()).uri).toBe('file:///cache/recording-2.m4a');
});

it('ticks whole seconds while recording and stops ticking after stop', async () => {
  jest.useFakeTimers();
  try {
    const recorder = makeRecorder();
    Recorder.mockImplementationOnce(() => recorder);
    const onTick = jest.fn();

    await voiceRecorder.start(onTick);
    recorder.currentTime = 1.4;
    jest.advanceTimersByTime(250);
    recorder.currentTime = 1.9;
    jest.advanceTimersByTime(250);
    expect(onTick.mock.calls).toEqual([[{ durationMs: 1000 }]]);

    await voiceRecorder.stop();
    recorder.currentTime = 5;
    jest.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
