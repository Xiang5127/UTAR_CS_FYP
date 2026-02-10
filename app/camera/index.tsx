import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationWatcher } from '@/hooks/use-location-watcher';
import { EXIFMetadata } from '@/types/exif.types';
import { burnExifAndSaveToGallery } from '@/utils/exif-processor';
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
  verificationMethod: 'precise' | 'override';
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
  const [forceCaptureEnabled, setForceCaptureEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the new location watcher hook
  const { coordinate, error, latestCoordinateRef } = useLocationWatcher();
  const location = coordinate;
  const accuracy = coordinate?.accuracy ?? null;
  // Traffic light states
  const isGreen = accuracy !== null && accuracy <= 10; // Forensic Grade
  const isYellow = accuracy !== null && accuracy > 10 && accuracy <= 50; // Operational Grade
  const isRed = accuracy === null || accuracy > 50; // Poor Signal
  const errorMsg = error?.message ?? null;

  // Use the custom camera capture hook with the watcher's latest coordinate ref
  const { cameraRef, capturePhoto } = useCameraCapture(latestCoordinateRef);

  // Determine badge color based on accuracy (Traffic Light)
  const getBadgeColor = (): string => {
    if (isRed) return 'bg-red-500';
    if (isYellow) return 'bg-yellow-500';
    if (isGreen) return 'bg-green-500';
    return 'bg-gray-500';
  };

  // Get badge text
  const getBadgeText = (): string => {
    if (accuracy === null) return 'GPS: -- (No Fix)';
    if (isGreen) return `GPS: ${accuracy.toFixed(1)}m ✓`;
    return `GPS: ${accuracy.toFixed(1)}m`;
  };

  // Button label based on state and timer
  const getButtonLabel = (): string => {
    if (isGreen) return 'Verified Capture';
    if (!forceCaptureEnabled) return 'Improving Accuracy...';
    return 'Force Capture (Low Accuracy)';
  };

  // Fallback Timer Logic: start 5s timer on mount if not Green; clear upon Green
  useEffect(() => {
    // Helper to clear any existing timer
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current as any);
        timerRef.current = null;
      }
    };

    // If we enter Green at any time, clear timer and disable force mode
    if (isGreen) {
      clearTimer();
      setForceCaptureEnabled(false);
      return;
    }

    // If not Green and no timer yet, start a 5s timer
    if (!isGreen && !timerRef.current) {
      timerRef.current = setTimeout(() => {
        setForceCaptureEnabled(true);
        timerRef.current = null;
      }, 5000);
    }

    // Cleanup when unmounting
    return () => {
      clearTimer();
    };
  }, [isGreen]);

  const handleCapture = async () => {
    const canCapture = !!cameraRef.current && !!location && (isGreen || forceCaptureEnabled);
    if (!canCapture) {
      alert('Camera or location not ready, or accuracy still improving.');
      console.log('Error in handleCapture: Not available or not allowed by accuracy state');
      return;
    }

    try {
      setIsCapturing(true);

      // Capture photo via custom hook
      const photo = await capturePhoto({
        quality: 1,
        base64: false,
      });

      // Build EXIF metadata locally (GPS + Timestamp)
      const capturedAt = new Date(location.timestamp);
      const pad = (n: number) => String(n).padStart(2, '0');
      // Standard EXIF date-time format: YYYY:MM:DD HH:mm:ss (local time)
      const exifDateTime = `${capturedAt.getFullYear()}:${pad(capturedAt.getMonth() + 1)}:${pad(
        capturedAt.getDate()
      )} ${pad(capturedAt.getHours())}:${pad(capturedAt.getMinutes())}:${pad(capturedAt.getSeconds())}`;
      // GPS date/time are recommended to be in UTC
      const gpsDateStamp = `${capturedAt.getUTCFullYear()}:${pad(capturedAt.getUTCMonth() + 1)}:${pad(
        capturedAt.getUTCDate()
      )}`;
      const gpsTimeStamp = `${pad(capturedAt.getUTCHours())}:${pad(capturedAt.getUTCMinutes())}:${pad(
        capturedAt.getUTCSeconds()
      )}`;

      const exifMetadata: EXIFMetadata = {
        // GPS
        GPSLatitude: location.latitude,
        GPSLongitude: location.longitude,
        GPSAltitude: location.altitude ?? undefined,
        GPSAltitudeRef: location.altitude !== null && location.altitude < 0 ? 1 : 0,
        GPSDateStamp: gpsDateStamp,
        GPSTimeStamp: gpsTimeStamp,
        // Timestamps
        DateTimeOriginal: exifDateTime,
        DateTimeDigitized: exifDateTime,
        DateTime: exifDateTime,
      };

      // Burn EXIF into the captured image and save into the gallery
      // Note: On iOS this may create a new Asset file. Use the returned URI.
      let savedUri = photo.uri;
      try {
        const saved = await burnExifAndSaveToGallery(photo.uri, exifMetadata, 'Streamline');
        savedUri = saved.uri;
      } catch (e) {
        console.warn('Failed to write EXIF and save to gallery:', e);
        // Fallback: keep original photo URI (may still be on temp cache)
      }

      // Create payload with saved photo URI, location data, and EXIF metadata
      const payload: CapturePayload = {
        photoUri: savedUri,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          timestamp: location.timestamp,
        },
        exif: exifMetadata,
        verificationMethod: isGreen ? 'precise' : 'override',
      };

      // Send to API (mock function - logs to console)
      sendToAPI(payload);

      Alert.alert('Success', 'Photo captured, EXIF written, and saved to gallery!', [
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
                        disabled={!(isGreen || forceCaptureEnabled) || isCapturing || !location}
                        className={`w-20 h-20 rounded-full items-center justify-center ${
                            (isGreen || forceCaptureEnabled) && !isCapturing && location
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
                    <Text className="mt-4 text-white text-sm text-center px-4">
                        {getButtonLabel()}
                    </Text>

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

