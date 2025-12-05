import { useEffect, useRef, useState, type RefObject } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { CameraCaptureResult, CameraState } from '@/types/camera.types';
import { LocationCoordinate } from '@/types/location.types';

/**
 * Custom hook for camera capture operations.
 *
 * Foundation structure — captures a photo and snapshots the latest GPS coordinate
 * from a ref provided by the location watcher.
 *
 * @param latestCoordinateRef - Ref containing latest GPS coordinate from location watcher
 * @returns Camera state and capture function
 */
export function useCameraCapture(
  latestCoordinateRef: RefObject<LocationCoordinate | null>
) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [state, setState] = useState<CameraState>({
    isReady: false,
    isLoading: false,
    error: null,
    hasPermission: permission?.granted ?? false,
  });

  /**
   * Capture a photo with GPS coordinates.
   * 
   * "Secret Sauce" Strategy:
   * - Snapshot latest coordinate from ref immediately (no waiting)
   * - Attach GPS metadata to photo
   * 
   * @param options - Camera capture options
   * @returns Promise resolving to CameraCaptureResult with location data
   */
  async function capturePhoto(
    options?: {
      quality?: number;
      base64?: boolean;
    }
  ): Promise<CameraCaptureResult> {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check permissions
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          throw new Error('Camera permission not granted');
        }
      }

      if (!cameraRef.current) {
        throw new Error('Camera ref not available');
      }

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: options?.quality ?? 1,
        base64: options?.base64 ?? false,
        skipProcessing: false,
      });

      // Snapshot latest GPS coordinate immediately (from ref - no waiting)
      const locationSnapshot: LocationCoordinate | null = latestCoordinateRef.current;

      const result: CameraCaptureResult = {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        location: locationSnapshot,
        exif: null, // Will be populated by EXIF processor
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('Failed to capture photo');
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw errorMessage;
    }
  }

  // Update permission state when permission changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      hasPermission: permission?.granted ?? false,
    }));
  }, [permission?.granted]);

  return {
    cameraRef,
    state,
    capturePhoto,
    requestPermission,
  };
}

