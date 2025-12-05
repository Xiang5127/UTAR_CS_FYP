import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationWatcher } from '@/hooks/use-location-watcher';
import { EXIFMetadata } from '@/types/exif.types';
import { mergeGPSIntoEXIF, processEXIFMetadata } from '@/utils/exif-processor';
import { useCameraCapture } from '@/hooks/use-camera-capture';

interface CapturePayload {
  photoUri: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    altitude: number | null;
    timestamp: number;
  };
  exif: EXIFMetadata | null;
}

/**
 * Send payload to API
 * Currently logs to console (replace with actual API call)
 */
function sendToAPI(payload: CapturePayload): void {
  console.log('📸 Capture Payload:', JSON.stringify(payload, null, 2));
  // TODO: Replace with actual API call
  // await fetch('https://api.example.com/capture', {
  //   method: 'POST',
  //   body: JSON.stringify(payload),
  // });
}

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

  // Use the new location watcher hook
  const { coordinate, error, latestCoordinateRef } = useLocationWatcher();
  const location = coordinate;
  const accuracy = coordinate?.accuracy ?? null;
  const isGPSLocked = accuracy !== null && accuracy < 10;
  const errorMsg = error?.message ?? null;

  // Use the custom camera capture hook with the watcher's latest coordinate ref
  const { cameraRef, capturePhoto } = useCameraCapture(latestCoordinateRef);

  // Determine badge color based on accuracy
  const getBadgeColor = (): string => {
    if (accuracy === null) return 'bg-gray-500';
    if (accuracy < 10) return 'bg-green-500';
    if (accuracy <= 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get badge text
  const getBadgeText = (): string => {
    if (accuracy === null) return 'GPS: --';
    if (accuracy < 10) return `GPS: ${accuracy.toFixed(1)}m ✓`;
    if (accuracy <= 20) return `GPS: ${accuracy.toFixed(1)}m`;
    return `GPS: ${accuracy.toFixed(1)}m`;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !isGPSLocked || !location) {
      alert('Camera, GPS lock, or location is not available.');
      console.log('Error in handleCapture: Not available');
      return;
    }

    try {
      setIsCapturing(true);

      // Capture photo via custom hook
      const photo = await capturePhoto({
        quality: 1,
        base64: false,
      });

      // Extract EXIF metadata from photo
      let exifMetadata: EXIFMetadata | null = null;
      try {
        const exifResult = await processEXIFMetadata(photo.uri);
        if (exifResult.success && exifResult.metadata) {
          // Merge GPS coordinates into EXIF metadata
          exifMetadata = mergeGPSIntoEXIF(
            exifResult.metadata,
            location.latitude,
            location.longitude,
            location.altitude ?? undefined
          );
        } else {
          console.warn('EXIF extraction failed:', exifResult.error);
          // Create basic EXIF with GPS data even if extraction failed
          exifMetadata = {
            GPSLatitude: location.latitude,
            GPSLongitude: location.longitude,
            GPSAltitude: location.altitude ?? undefined,
            GPSAltitudeRef: location.altitude !== null && location.altitude < 0 ? 1 : 0,
            DateTimeOriginal: new Date(location.timestamp).toISOString(),
          };
        }
      } catch (exifError) {
        console.warn('EXIF processing error:', exifError);
        // Fallback: create basic EXIF with GPS data
        exifMetadata = {
          GPSLatitude: location.latitude,
          GPSLongitude: location.longitude,
          GPSAltitude: location.altitude ?? undefined,
          GPSAltitudeRef: location.altitude !== null && location.altitude < 0 ? 1 : 0,
          DateTimeOriginal: new Date(location.timestamp).toISOString(),
        };
      }

      // Create payload with photo URI, location data, and EXIF metadata
      const payload: CapturePayload = {
        photoUri: photo.uri,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          timestamp: location.timestamp,
        },
        exif: exifMetadata,
      };

      // Send to API (mock function - logs to console)
      sendToAPI(payload);

      Alert.alert('Success', 'Photo captured with GPS and EXIF data!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to capture photo';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsCapturing(false);
    }
  };

  // Request camera permission if not granted
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="mt-4 text-white">Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-4">
        <Text className="mb-4 text-center text-white text-lg">
          Camera permission is required to capture photos.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-blue-500 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">

      {/* Full screen camera view */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="picture"
      />

      {/* Overlay split into top and bottom halves with a middle separator line */}
      <View className="absolute inset-0">

        {/* Top Half */}
        <View style={{ flex: 1, paddingTop: insets.top + 8 }} className="relative">

          {/* Optional Border UI */}
          <View className="absolute bottom-10 right-10 w-8 h-8 border-b-4 border-r-4 border-white/50" />
          <View className="absolute bottom-10 left-10 w-8 h-8 border-b-4 border-l-4 border-white/50" />

          {/* GPS meter tracker */}
          <View className="mx-4">
            {errorMsg ? (
              <View className="bg-red-500 px-4 py-2 rounded-lg">
                <Text className="text-white text-sm font-semibold">{errorMsg}</Text>
              </View>
            ) : (
              <View className={`${getBadgeColor()} px-4 py-2 rounded-lg self-start`}>
                <Text className="text-white text-sm font-semibold">{getBadgeText()}</Text>
              </View>
            )}
          </View>

          {/* Visual Guide Label (Centered in Top Half) */}
          <View className="absolute inset-0 items-center justify-center pointer-events-box-none">
              <Text className="text-white text-lg font-bold opacity-70">
                  CAPTURE BUILDING HERE
              </Text>
          </View>
        </View>

        {/* Middle Separator */}
        <View style={styles.separatorLine} />

        {/* Bottom Half */}
        <View style={{ flex: 1, paddingBottom: insets.bottom + 24 }} className="items-center justify-end relative">

            {/* Centered Guide Text */}
            <View className="absolute inset-0 items-center justify-center mb-20 pointer-events-box-none">
                <Text className="text-white text-lg font-bold opacity-70 ">
                    CAPTURE PARCEL HERE
                </Text>
            </View>

            <TouchableOpacity
            onPress={handleCapture}
            disabled={!isGPSLocked || isCapturing || !location}
            className={`w-20 h-20 rounded-full items-center justify-center ${
              isGPSLocked && !isCapturing && location
                ? 'bg-white'
                : 'bg-gray-500'
            }`}
            activeOpacity={0.8}>
            {isCapturing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View className="w-16 h-16 rounded-full border-4 border-gray-800" />
            )}
          </TouchableOpacity>

          {/* Helper text */}
          {!isGPSLocked && (
            <Text className="mt-4 text-white text-sm text-center px-4">
              Waiting for GPS lock (accuracy {'<'} 10m required)
            </Text>
          )}

            {/* Optional Border/Frame */}
            <View className="absolute top-10 left-10 w-8 h-8 border-t-4 border-l-4 border-white/50" />
            <View className="absolute top-10 right-10 w-8 h-8 border-t-4 border-r-4 border-white/50" />

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    width: '100%',
  },
  separatorLine: {
      height: 2, // h-0.5 (0.5 * 4 = 2px)
      width: '90%', // w-full
      backgroundColor: '#FACC15', // bg-yellow-400 (Tailwind's default yellow-400 hex)
      opacity: 0.8, // opacity-80
      flexDirection: 'row', // flex-row
      alignSelf: 'center', // items-center
      justifyContent: 'center', // justify-center
  },
});

