/**
 * EXIF metadata processor utilities (client-only).
 *
 * This module focuses on writing EXIF tags (not reading via a backend).
 * Photos are saved locally with GPS EXIF embedded and optionally added to the gallery.
 */

import { EXIFMetadata } from '@/types/exif.types';
import { writeAsync } from '@lodev09/react-native-exify';

// Note: Previously this file exported `processEXIFMetadata` which uploaded
// the image to a backend to read EXIF. The app no longer depends on any backend
// for EXIF extraction; we only write GPS EXIF locally and save to gallery.

/**
 * Write EXIF metadata into a local image file, then save it to the device gallery.
 *
 * Notes:
 * - On iOS, writing EXIF into an Asset URI is not allowed. Always write to the local
 *   output file first (e.g., camera output), then save to the Photos library.
 * - On Android, EXIF is written in-place for file URIs.
 *
 * @param photoUri - Local URI of the captured photo (file://...)
 * @param exifTags - EXIF tags to merge/write into the image
 * @param albumName - Optional album name to save into (will create if missing)
 * @returns Object containing the final saved asset URI and ID (when available)
 */
export async function burnExifAndSaveToGallery(
  photoUri: string,
  exifTags: EXIFMetadata,
  albumName?: string
): Promise<{ uri: string; assetId?: string }> {
  // 1) Burn/merge EXIF into the local file first
  const writeResult = await writeAsync(photoUri, exifTags as any);
  const writtenUri = writeResult?.uri ?? photoUri;

  // 2) Dynamically import expo-media-library (avoids crashes on web/unsupported envs)
  let MediaLibrary: typeof import('expo-media-library') | null = null;
  try {
    MediaLibrary = await import('expo-media-library');
  } catch (e) {
    console.warn(
      "[burnExifAndSaveToGallery] 'expo-media-library' not found. " +
        'Ensure it is installed (npx expo install expo-media-library) and you are running a Dev Client/EAS build.'
    );
    return { uri: writtenUri };
  }

  // 3) Request media library permissions and save to gallery
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    // Permission denied — return the written file URI without saving to gallery
    return { uri: writtenUri };
  }

  const asset = await MediaLibrary.createAssetAsync(writtenUri);

  if (albumName && albumName.trim().length > 0) {
    try {
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }
    } catch (e) {
      // If album ops fail, at least the asset is created in the library
      // Swallow and continue.
    }
  }

  // Asset URI may differ from the original file URI
  return { uri: asset.uri, assetId: asset.id };
}

/**
 * Merge GPS coordinates into EXIF metadata.
 * 
 * @param exifMetadata - Existing EXIF metadata
 * @param latitude - GPS latitude
 * @param longitude - GPS longitude
 * @param altitude - GPS altitude (optional)
 * @returns Updated EXIF metadata with GPS data
 */
export function mergeGPSIntoEXIF(
  exifMetadata: EXIFMetadata,
  latitude: number,
  longitude: number,
  altitude?: number
): EXIFMetadata {
  return {
    ...exifMetadata,
    GPSLatitude: latitude,
    GPSLongitude: longitude,
    GPSAltitude: altitude,
    GPSAltitudeRef: altitude !== undefined && altitude < 0 ? 1 : 0,
  };
}

/**
 * Writes EXIF metadata into a local image file only.
 * Does not save to gallery — use when upload to cloud handles persistence.
 */
export async function burnExifOnly(
    photoUri: string,
    exifTags: EXIFMetadata
): Promise<{ uri: string }> {
    const writeResult = await writeAsync(photoUri, exifTags as any);
    return { uri: writeResult?.uri ?? photoUri };
}

/**
 * Saves an already-processed image URI to the device gallery.
 * Used after upload to keep the gallery save separate from the upload step.
 */
export async function saveToGalleryOnly(
    fileUri: string,
    albumName?: string
): Promise<void> {
    let MediaLibrary: typeof import('expo-media-library') | null = null;
    try {
        MediaLibrary = await import('expo-media-library');
    } catch {
        return;
    }

    let permission = await MediaLibrary.getPermissionsAsync(true);
    if (!permission.granted && permission.canAskAgain) {
        permission = await MediaLibrary.requestPermissionsAsync(true);
    }
    if (!permission.granted) return;

    const asset = await MediaLibrary.createAssetAsync(fileUri);

    if (albumName?.trim()) {
        try {
            const album = await MediaLibrary.getAlbumAsync(albumName);
            if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
                await MediaLibrary.createAlbumAsync(albumName, asset, false);
            }
        } catch {
            // asset already created, swallow album error
        }
    }
}
