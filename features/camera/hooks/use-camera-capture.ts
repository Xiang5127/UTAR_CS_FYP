import { useEffect, useRef, useState, type RefObject } from 'react';
import { Camera, useCameraDevice, useCameraFormat } from 'react-native-vision-camera';

import { LocationCoordinate } from '@/types/location.types';
import { CameraCaptureOptions, CameraCaptureResult, CameraState } from '../types/camera.types';
import { useCameraPermissions } from './use-camera-permissions';

export interface UseCameraCaptureReturn {
    cameraRef: React.RefObject<Camera | null>;
    device: ReturnType<typeof useCameraDevice>;
    format: ReturnType<typeof useCameraFormat>;
    state: CameraState;
    capturePhoto: (options?: CameraCaptureOptions) => Promise<CameraCaptureResult>;
}

/**
 * Custom hook for camera capture operations with react-native-vision-camera.
 *
 * Foundation structure — captures a photo and snapshots the latest GPS coordinate
 * from a ref provided by the location watcher.
 *
 * @param latestCoordinateRef - Ref containing latest GPS coordinate from location watcher
 * @returns Camera state, ref, device, format, and capture function
 */
export function useCameraCapture(
    latestCoordinateRef: RefObject<LocationCoordinate | null>
): UseCameraCaptureReturn {
    const { permission, requestPermission, hasPermission } = useCameraPermissions();
    const cameraRef = useRef<Camera>(null);

    const device = useCameraDevice('back');
    const format = useCameraFormat(device, [
        { photoResolution: 'max' },
        { photoAspectRatio: 4 / 3 },
    ]);

    const [state, setState] = useState<CameraState>({
        isReady: false,
        isLoading: false,
        error: null,
        hasPermission: false,
    });

    useEffect(() => {
        if (hasPermission) {
            setState((prev) => ({
                ...prev,
                hasPermission: true,
                isReady: !!device,
            }));
        }
    }, [hasPermission, device]);

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
        options?: CameraCaptureOptions
    ): Promise<CameraCaptureResult> {
        try {
            setState((prev) => ({ ...prev, isLoading: true, error: null }));

            // Check permissions
            if (!hasPermission) {
                const result = await requestPermission();
                if (!result.granted) {
                    throw new Error('Camera permission not granted');
                }
            }

            if (!cameraRef.current) {
                throw new Error('Camera ref not available');
            }

            if (!device) {
                throw new Error('Camera device not available');
            }

            // Capture photo with vision-camera
            const photo = await cameraRef.current.takePhoto({
                flash: 'off',
            });

            // Snapshot latest GPS coordinate immediately (from ref - no waiting)
            const locationSnapshot: LocationCoordinate | null = latestCoordinateRef.current;

            const result: CameraCaptureResult = {
                uri: `file://${photo.path}`, // vision-camera returns path, convert to file URI
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
            const errorMessage =
                error instanceof Error ? error : new Error('Failed to capture photo');
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));
            throw errorMessage;
        }
    }

    return {
        cameraRef,
        device,
        format,
        state,
        capturePhoto,
    };
}
