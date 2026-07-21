import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Local staging for job photos awaiting upload. Camera/picker output lands in
 * the OS cache, which can be purged any time — a queued photo must instead live
 * in the app's document directory until its upload succeeds (jobsites have dead
 * zones, so that can be a while, including across app restarts).
 */

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}job-photos/`;

/**
 * Move a just-captured/picked image into permanent app storage and return its
 * new uri. On web the uri (a blob url) is returned unchanged — it can't be
 * persisted, so web uploads only survive within the page session.
 */
export async function stashPhotoFile(
  uri: string,
  photoId: string,
  ext: 'jpg' | 'mp4' = 'jpg'
): Promise<string> {
  if (Platform.OS === 'web') return uri;
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(
    () => {}
  );
  const dest = `${PHOTO_DIR}${photoId}.${ext}`;
  await FileSystem.moveAsync({ from: uri, to: dest });
  return dest;
}

/** Remove a stashed photo file (after a successful upload or a discard). */
export async function discardPhotoFile(uri: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

/**
 * The job-photos bucket's file size limit (see the scopes-counts-videos
 * migration). A file over this would be rejected server-side on every retry —
 * addJobPhotos refuses it up front instead.
 */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Size of a local media file in bytes, or null when it can't be read. */
export async function mediaFileSize(uri: string): Promise<number | null> {
  if (Platform.OS === 'web') {
    try {
      return (await (await fetch(uri)).blob()).size;
    } catch {
      return null;
    }
  }
  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  return info?.exists ? (info.size ?? null) : null;
}
