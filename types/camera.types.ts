/**
 * Camera-related TypeScript interfaces for photo capture
 */

import { LocationCoordinate } from './location.types';
import { EXIFMetadata } from './exif.types';

export interface CameraCaptureOptions {
    quality?: number;
    base64?: boolean;
    skipProcessing?: boolean;
    allowsEditing?: boolean;
    aspect?: [number, number];
}

export interface CameraCaptureResult {
    uri: string;
    width: number;
    height: number;
    location: LocationCoordinate | null;
    exif: EXIFMetadata | null;
    timestamp: number;
}

export interface CameraPermissionStatus {
    granted: boolean;
    canAskAgain: boolean;
    status: 'granted' | 'denied' | 'undetermined';
}

export interface CameraState {
    isReady: boolean;
    isLoading: boolean;
    error: Error | null;
    hasPermission: boolean;
}
