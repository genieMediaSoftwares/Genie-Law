import { filePicker } from './filePicker';
import { imageCompressor } from './imageCompressor';
import type { ImageCompressionStep, PickedFile } from '../types/ai';
import type { PerfTrace } from '../utils/perfTrace';
import { logError } from '../utils/log';

// What authApi.uploadProfileImage accepts: a browser File on web, or React
// Native's { uri, name, type } multipart descriptor on Android/iOS.
export type ProfilePhotoUpload = File | { uri: string; name: string; type: string };

// Phone camera photos are commonly 4-10 MB. Sent raw, that is 30-80s on a
// 1 Mbps mobile uplink for an avatar. One on-device resize to 1600px at 85%
// JPEG quality (~300-500 KB) stays sharp even in the full-screen photo viewer
// on phone screens, and uploads in a few seconds.
const PROFILE_PHOTO_STEP: ImageCompressionStep = { maxDimension: 1600, quality: 0.85 };

// Small images gain almost nothing from re-encoding; send them as picked.
const COMPRESS_ABOVE_BYTES = 600 * 1024;

async function shrinkIfLarge(picked: PickedFile): Promise<PickedFile> {
  if (picked.size !== null && picked.size <= COMPRESS_ABOVE_BYTES) {
    return picked;
  }
  try {
    const compressed = await imageCompressor.compress(picked, PROFILE_PHOTO_STEP);
    // Only use the resized copy if it is actually smaller.
    if (picked.size === null || (compressed.size ?? Infinity) < picked.size) {
      return compressed;
    }
  } catch (error) {
    // Unreadable by the resizer (e.g. an unusual format): upload the original,
    // and let the server accept or reject it with its real error.
    logError('profile-photo-compress', error);
  }
  return picked;
}

// Lets the user choose one image and returns it, resized if it is large, in
// the shape the upload API needs for the current platform; null if cancelled.
export async function pickProfilePhoto(trace?: PerfTrace): Promise<ProfilePhotoUpload | null> {
  const picked = await filePicker.pickImage();
  if (!picked) {
    return null;
  }
  trace?.mark(`picked(${picked.size ?? '?'}B)`);

  const photo = await shrinkIfLarge(picked);
  trace?.mark(`compressed(${photo.size ?? '?'}B)`);

  if (typeof File !== 'undefined' && photo.file instanceof File) {
    return photo.file;
  }
  if (typeof Blob !== 'undefined' && photo.file instanceof Blob) {
    return new File([photo.file], photo.name, { type: photo.type || 'image/jpeg' });
  }

  return {
    uri: photo.uri,
    name: photo.name,
    type: photo.type || 'image/jpeg',
  };
}
