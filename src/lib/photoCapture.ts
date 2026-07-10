import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Image intake for job photos: everything that enters the upload queue funnels
 * through {@link compressJobPhoto} so uploads stay fast on jobsite cell signal.
 */

/** Longest edge a stored job photo keeps. */
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Downscale a captured/picked image to at most {@link MAX_WIDTH}px wide and
 * re-encode as JPEG. `width` (when the source reports it) skips the resize for
 * images already small enough.
 */
export async function compressJobPhoto(
  uri: string,
  width?: number
): Promise<string> {
  const actions =
    width && width <= MAX_WIDTH ? [] : [{ resize: { width: MAX_WIDTH } }];
  const result = await manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * Open the OS camera to take ONE photo (native only) and return its compressed
 * local uri. Returns null when cancelled or permission is denied. Used for
 * single reference shots (e.g. the flashing material photo) — the multi-shot
 * in-app camera lives at /camera/[jobId].
 */
export async function captureSingleJobPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  try {
    return await compressJobPhoto(asset.uri, asset.width);
  } catch (e) {
    console.error('Could not process captured image:', e);
    return null;
  }
}

/**
 * Pick ONE photo from the gallery (native) or file system (web) and return its
 * compressed local uri, or null when cancelled.
 */
export async function pickSingleJobPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  try {
    return await compressJobPhoto(asset.uri, asset.width);
  } catch (e) {
    console.error('Could not process picked image:', e);
    return null;
  }
}

/**
 * Let the user pick photos from their gallery (native) or file system (web) and
 * return the compressed local uris, ready for the upload queue. Returns [] when
 * the picker is cancelled or permission is denied.
 */
export async function pickJobPhotos(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];
  const uris: string[] = [];
  for (const asset of result.assets) {
    try {
      uris.push(await compressJobPhoto(asset.uri, asset.width));
    } catch (e) {
      console.error('Could not process picked image:', e);
    }
  }
  return uris;
}
