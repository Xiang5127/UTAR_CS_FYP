import { useCallback, useEffect, useState } from 'react';
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

        // Auto-request on fresh install so the system dialog appears immediately
        if (cameraPermission === 'not-determined') {
            const requested = await Camera.requestCameraPermission();
            setPermission({
                granted: requested === 'granted',
                status: requested as CameraPermissionStatus['status'],
                canAskAgain: requested !== 'denied',
            });
            return;
        }

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
