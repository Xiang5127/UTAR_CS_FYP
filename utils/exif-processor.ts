/**
 * EXIF metadata processor utility.
 *
 * Uses a backend endpoint to extract EXIF metadata from an uploaded photo.
 * Placeholder implementation — ready for backend integration.
 */

import { EXIFMetadata, EXIFProcessingResult } from '@/types/exif.types';

/**
 * Process EXIF metadata from a photo URI.
 * 
 * This function will send the photo to a Node.js backend for EXIF extraction.
 * The backend handles EXIF processing to avoid heavy client-side processing.
 * 
 * @param photoUri - URI of the photo to process
 * @param backendUrl - URL of the Node.js backend endpoint (optional, defaults to env var)
 * @returns Promise resolving to EXIFProcessingResult
 */
export async function processEXIFMetadata(
  photoUri: string,
  backendUrl?: string
): Promise<EXIFProcessingResult> {
  try {
    // TODO: Replace with actual backend URL from environment variables
    const apiUrl = backendUrl ?? process.env.EXPO_PUBLIC_EXIF_API_URL ?? 'http://localhost:3000/api/exif';

    // Create FormData to send photo
    const formData = new FormData();
    formData.append('photo', {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as unknown as Blob);

    // Send to backend
    // Note: Do not set Content-Type header manually - the runtime automatically
    // sets it with the correct boundary for multipart/form-data
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      metadata: data.metadata as EXIFMetadata,
    };

  } catch (error) {
    return {
      success: false,
      metadata: null,
      error: error instanceof Error ? error.message : 'Unknown error processing EXIF',
    };
  }
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

