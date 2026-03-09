import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationWatcher } from '@/hooks/use-location-watcher';
import { EXIFMetadata } from '@/types/exif.types';
import { burnExifOnly, saveToGalleryOnly } from '@/utils/exif-processor';
import { useCameraCapture } from '@/hooks/use-camera-capture';
import { buildExifFromCoordinate } from '@/utils/exif-builder';
import { useAccuracySignal } from '@/hooks/use-accuracy-signal';
import { sendToAPI, CapturePayload } from '@/utils/api';
import BarcodeViewfinder from '@/components/BarcodeViewfinder';

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [forceCaptureEnabled, setForceCaptureEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Barcode state
    const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
    const isScanningRef = useRef(true); // prevents multiple scans firing at once

    // Use the new location watcher hook
    const { coordinate, error, latestCoordinateRef } = useLocationWatcher();
    const location = coordinate;
    const errorMsg = error?.message ?? null;

  // Use the custom camera capture hook with the watcher's latest coordinate ref
  const { cameraRef, capturePhoto } = useCameraCapture(latestCoordinateRef);

    const accuracy = coordinate?.accuracy ?? null;
    const { badgeColor, badgeText, buttonLabel, isGreen } = useAccuracySignal(accuracy, forceCaptureEnabled);

    // Capture button requires BOTH barcode scanned AND GPS ready
    const canCapture = !!cameraRef.current && !!location && !!trackingNumber && (isGreen || forceCaptureEnabled);

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

  // Barcode scan handler
  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
      // Only process Code 128 barcodes and only if not already scanned
      if (!isScanningRef.current) return;
      if (result.type !== 'code128') return;

      isScanningRef.current = false; // lock to prevent duplicate scans
      setTrackingNumber(result.data);
  };

  // Reset barcode scan (allow rescanning)
  const handleRescan = () => {
      setTrackingNumber(null);
      isScanningRef.current = true;
  };

  // THE MAGIC OF EVERYTHING
  const handleCapture = async () => {
    if (!canCapture) {
      alert('Camera, location, or barcode not ready.');
      console.log('Error in handleCapture: Not available or not allowed by accuracy state');
      return;
    }

    try {
      setIsCapturing(true);

        // 1) Capture photo
        const photo = await capturePhoto({
            quality: 1,
            base64: false,
        });

        // 2) Build EXIF metadata from current location snapshot
        const exifMetadata: EXIFMetadata = buildExifFromCoordinate(location);

        // 3) Burn EXIF into temp file — get back the EXIF-written temp URI
        let exifUri = photo.uri;
        try {
            const written = await burnExifOnly(photo.uri, exifMetadata);
            exifUri = written.uri;
        } catch (e) {
            console.warn('Failed to write EXIF:', e);
        }

        // 4) Save to gallery in foreground — Android popup (can't suppress, Android 10 problem) appears here
        //    while user is still on camera page, contextually makes sense
        await saveToGalleryOnly(exifUri, 'Streamline');

        // 5) Build payload
        const payload: CapturePayload = {
            photoUri: exifUri,
            location: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                altitude: location.altitude,
                timestamp: location.timestamp,
            },
            exif: exifMetadata,
            accuracyStatus: isGreen ? 'precise' : 'override',
            trackingNumber: trackingNumber!,
        };

        // 6) Show success after gallery save confirms
        Alert.alert('Success', 'Photo captured, EXIF written, and saved to gallery!', [
            { text: 'OK', onPress: () => router.back() },
        ]);

        // 7) Upload to Supabase in background
        sendToAPI(payload).catch((e) => {
            console.warn('Background upload failed:', e);
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to capture photo';
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
                barcodeScannerSettings={{ barcodeTypes: ['code128'] }}
                onBarcodeScanned={trackingNumber ? undefined : handleBarcodeScanned}
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
                            <View style={{ backgroundColor: badgeColor }} className="px-4 py-2 rounded-lg self-start">
                                <Text className="text-white text-sm font-semibold">{badgeText}</Text>
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

                    {/* Barcode viewfinder — centered in parcel zone */}
                    <View className="absolute inset-0 items-center justify-center mb-16">
                        <BarcodeViewfinder isDetected={!!trackingNumber} />
                        {/* Tracking number display below viewfinder */}
                        {trackingNumber ? (
                            <View className="items-center mt-3">
                                <Text className="text-green-400 text-sm font-bold">{trackingNumber}</Text>
                                <TouchableOpacity onPress={handleRescan} className="mt-1">
                                    <Text className="text-yellow-400 text-xs underline">Rescan</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text className="text-white/60 text-xs mt-3">Point at Code 128 barcode</Text>
                        )}
                    </View>

                    {/* Capture button */}
                    <TouchableOpacity
                        onPress={handleCapture}
                        disabled={!canCapture || isCapturing}
                        className={`w-20 h-20 rounded-full items-center justify-center ${
                            canCapture && !isCapturing ? 'bg-white' : 'bg-gray-500'
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
                        {!trackingNumber ? 'Scan parcel barcode to unlock capture' : buttonLabel}
                    </Text>

                    <View className="absolute top-10 left-10 w-8 h-8 border-t-4 border-l-4 border-white/50" />
                    <View className="absolute top-10 right-10 w-8 h-8 border-t-4 border-r-4 border-white/50" />

                    {/*/!* Centered Guide Text *!/*/}
                    {/*<View className="absolute inset-0 items-center justify-center mb-20 pointer-events-box-none">*/}
                    {/*    <Text className=" text-white text-lg font-bold opacity-70 ">*/}
                    {/*        CAPTURE PARCEL HERE*/}
                    {/*    </Text>*/}
                    {/*</View>*/}

                    {/* Capture Button */}
                    {/*<TouchableOpacity*/}
                    {/*    onPress={handleCapture}*/}
                    {/*    disabled={!(isGreen || forceCaptureEnabled) || isCapturing || !location}*/}
                    {/*    className={`w-20 h-20 rounded-full items-center justify-center ${*/}
                    {/*        (isGreen || forceCaptureEnabled) && !isCapturing && location*/}
                    {/*            ? 'bg-white'*/}
                    {/*            : 'bg-gray-500'*/}
                    {/*    }`}*/}
                    {/*    activeOpacity={0.8}>*/}
                    {/*    {isCapturing ? (*/}
                    {/*        <ActivityIndicator size="small" color="#000" />*/}
                    {/*    ) : (*/}
                    {/*        <View className="w-16 h-16 rounded-full border-4 border-gray-800" />*/}
                    {/*    )}*/}
                    {/*</TouchableOpacity>*/}

                    {/*/!* Helper text *!/*/}
                    {/*<Text className="mt-4 text-white text-sm text-center px-4">*/}
                    {/*    {buttonLabel}*/}
                    {/*</Text>*/}

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

