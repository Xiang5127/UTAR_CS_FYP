/**
 * Camera feature types for react-native-vision-camera v4
 */

import { LocationCoordinate } from '@/types/location.types';
import { EXIFMetadata } from '@/types/exif.types';

export interface CameraCaptureOptions {
    quality?: number;
    base64?: boolean;
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
    status: 'granted' | 'denied' | 'not-determined';
    canAskAgain: boolean;
}

export interface CameraState {
    isReady: boolean;
    isLoading: boolean;
    error: Error | null;
    hasPermission: boolean;
}

export interface BarcodeScanResult {
    value: string;
    type: string;
    corners: { x: number; y: number }[];
}

export interface BarcodeScannerState {
    scanResult: BarcodeScanResult | null;
    corners: { x: number; y: number }[] | null;
    isScanning: boolean;
}
