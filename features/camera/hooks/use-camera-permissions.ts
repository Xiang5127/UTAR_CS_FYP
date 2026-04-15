import { useState, useEffect, useCallback } from 'react';
import { Camera } from 'react-native-vision-camera';

import { CameraPermissionStatus } from '../types/camera.types';

export interface UseCameraPermissionsReturn {
    permission: CameraPermissionStatus | null;
    requestPermission: () => Promise<CameraPermissionStatus>;
    hasPermission: boolean;
}

/**
 * Hook for managing camera permissions with react-native-vision-camera.
 */
export function useCameraPermissions(): UseCameraPermissionsReturn {
    const [permission, setPermission] = useState<CameraPermissionStatus | null>(null);

    useEffect(() => {
        checkPermission();
    }, []);

    async function checkPermission() {
        const cameraPermission = await Camera.getCameraPermissionStatus();
        setPermission({
            granted: cameraPermission === 'granted',
            status: cameraPermission as CameraPermissionStatus['status'],
            canAskAgain: cameraPermission !== 'denied',
        });
    }

    const requestPermission = useCallback(async (): Promise<CameraPermissionStatus> => {
        const cameraPermission = await Camera.requestCameraPermission();
        const newStatus: CameraPermissionStatus = {
            granted: cameraPermission === 'granted',
            status: cameraPermission as CameraPermissionStatus['status'],
            canAskAgain: cameraPermission !== 'denied',
        };
        setPermission(newStatus);
        return newStatus;
    }, []);

    return {
        permission,
        requestPermission,
        hasPermission: permission?.granted ?? false,
    };
}
