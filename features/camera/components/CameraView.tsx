import React from 'react';
import { StyleSheet } from 'react-native';
import { Camera, CodeScanner } from 'react-native-vision-camera';

interface CameraViewProps {
    cameraRef: React.RefObject<Camera | null>;
    device: ReturnType<typeof import('react-native-vision-camera').useCameraDevice>;
    format: ReturnType<typeof import('react-native-vision-camera').useCameraFormat>;
    isActive: boolean;
    codeScanner?: CodeScanner;
}

/**
 * Camera view component wrapping react-native-vision-camera's Camera.
 */
export const CameraView: React.FC<CameraViewProps> = ({
    cameraRef,
    device,
    format,
    isActive,
    codeScanner,
}) => {
    if (!device) {
        return null;
    }

    return (
        <Camera
            ref={cameraRef}
            style={styles.camera}
            device={device}
            format={format}
            isActive={isActive}
            photo={true}
            codeScanner={codeScanner}
        />
    );
};

const styles = StyleSheet.create({
    camera: {
        flex: 1,
        width: '100%',
    },
});
