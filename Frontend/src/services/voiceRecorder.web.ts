import type { PickedFile } from '../types/ai';
import i18n from '../i18n';

export interface RecordingState {
  durationMs: number;
}

const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

const baseMime = (type: string): string => type.split(';')[0];

const pickMimeType = (): string | null => {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  for (const candidate of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return null;
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
};

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let ticker: ReturnType<typeof setInterval> | null = null;

const releaseStream = () => {
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
};

const stopTicker = () => {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
};

export const voiceRecorder = {
  isSupported:
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined' &&
    pickMimeType() !== null,

  async requestPermission(): Promise<boolean> {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  },

  async start(onTick: (state: RecordingState) => void): Promise<void> {
    const mimeType = pickMimeType();
    if (!mimeType) {
      throw new Error(i18n.t('documents:voice.browserUnsupported'));
    }

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];

    recorder = new MediaRecorder(stream, { mimeType });
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.start(250);

    const startedAt = Date.now();
    ticker = setInterval(
      () => onTick({ durationMs: Date.now() - startedAt }),
      100,
    );
  },

  async stop(): Promise<PickedFile> {
    stopTicker();

    const active = recorder;
    if (!active) {
      throw new Error(i18n.t('documents:voice.notRecording'));
    }

    const mimeType = baseMime(active.mimeType || 'audio/webm');

    const blob = await new Promise<Blob>(resolve => {
      active.addEventListener(
        'stop',
        () => resolve(new Blob(chunks, { type: mimeType })),
        { once: true },
      );
      active.stop();
    });

    releaseStream();
    recorder = null;

    const extension = EXTENSION_BY_MIME[mimeType] ?? '.webm';
    const name = `genie-voice-note${extension}`;

    return {
      uri: '',
      name,
      type: mimeType,
      size: blob.size,
      file: new File([blob], name, { type: mimeType }),
    };
  },

  async cancel(): Promise<void> {
    stopTicker();
    try {
      recorder?.stop();
    } catch {
    }
    releaseStream();
    recorder = null;
    chunks = [];
  },
};
