import { Platform } from 'react-native';
import {
  AudioModule,
  IOSOutputFormat,
  AudioQuality,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';

import type { PickedFile } from '../types/ai';
import i18n from '../i18n';

// Voice notes on iOS/Android, recorded with expo-audio (works in Expo Go and
// in development/production builds). The web build uses voiceRecorder.web.ts.

export interface RecordingState {
  durationMs: number;
}

const FILE_NAME = 'genie-voice-note.m4a';
const TICK_MS = 250;

// Mono AAC in an .m4a container: small, and what the backend accepts
// (audio/m4a). expo-audio takes the options already flattened per platform.
const COMMON = { extension: '.m4a', sampleRate: 44100, numberOfChannels: 1, bitRate: 64000 };
const RECORDING_OPTIONS =
  Platform.OS === 'ios'
    ? {
        ...COMMON,
        outputFormat: IOSOutputFormat.MPEG4AAC,
        audioQuality: AudioQuality.HIGH,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      }
    : { ...COMMON, outputFormat: 'mpeg4', audioEncoder: 'aac' };

let recorder: AudioRecorder | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

const stopTicker = () => {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
};

const release = async () => {
  stopTicker();
  const current = recorder;
  recorder = null;
  if (current) {
    try {
      current.release();
    } catch {
      // Already released.
    }
  }
  // Back to normal playback mode once recording is over.
  await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
};

export const voiceRecorder = {
  isSupported: true,

  async requestPermission(): Promise<boolean> {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  },

  async start(onTick: (state: RecordingState) => void): Promise<void> {
    await release();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    // Held before preparing, so a failure below still releases the microphone.
    const next = new AudioModule.AudioRecorder(RECORDING_OPTIONS);
    recorder = next;
    try {
      await next.prepareToRecordAsync();
      next.record();
    } catch (error) {
      await release();
      throw error;
    }

    // The UI shows whole seconds: report only when the second changes.
    let lastSecond = -1;
    ticker = setInterval(() => {
      const second = Math.floor(next.currentTime);
      if (second !== lastSecond) {
        lastSecond = second;
        onTick({ durationMs: second * 1000 });
      }
    }, TICK_MS);
  },

  async stop(): Promise<PickedFile> {
    const current = recorder;
    if (!current) {
      throw new Error(i18n.t('documents:voice.noRecording'));
    }
    stopTicker();
    await current.stop();
    const uri = current.uri;
    await release();

    if (!uri) {
      throw new Error(i18n.t('documents:voice.saveFailed'));
    }
    return {
      uri: uri.startsWith('/') ? `file://${uri}` : uri,
      name: FILE_NAME,
      type: 'audio/m4a',
      size: null,
    };
  },

  async cancel(): Promise<void> {
    const current = recorder;
    if (current) {
      try {
        await current.stop();
      } catch {
        // Not recording.
      }
    }
    await release();
  },
};
