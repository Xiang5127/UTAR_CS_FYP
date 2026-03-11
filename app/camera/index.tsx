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
    const isScanningRef = useRef(true);

    // Add to state
    const [barcodeCorners, setBarcodeCorners] = useState<{ x: number; y: number }[] | null>(null);

    // Track the parcel zone's position on screen
    const parcelZoneRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

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

    const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastScannedDataRef = useRef<string | null>(null);
    const stableCountRef = useRef(0);
    const REQUIRED_STABLE_COUNT = 4; // must see same barcode 4 frames in a row

    const handleBarcodeScanned = (result: BarcodeScanningResult) => {
        if (!isScanningRef.current) return;
        if (result.type !== 'code128') return;

        // If same data as last frame, increment stable count
        if (result.data === lastScannedDataRef.current) {
            stableCountRef.current += 1;
        } else {
            // Different data — reset count, store new candidate
            lastScannedDataRef.current = result.data;
            stableCountRef.current = 1;
            // Update corners live as camera moves, but don't lock yet
            setBarcodeCorners(result.cornerPoints ?? null);
            return;
        }

        // Update corners on every stable frame so they track smoothly
        setBarcodeCorners(result.cornerPoints ?? null);

        // Only lock in once we have enough stable consecutive readings
        if (stableCountRef.current >= REQUIRED_STABLE_COUNT) {
            isScanningRef.current = false;
            setTrackingNumber(result.data);
        }
    };

    const handleRescan = () => {
        if (scanDebounceRef.current) clearTimeout(scanDebounceRef.current);
        lastScannedDataRef.current = null;
        stableCountRef.current = 0;
        setTrackingNumber(null);
        setBarcodeCorners(null);
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
                    <View className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-white/50" />
                    <View className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-white/50" />

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
                <View
                    style={{ flex: 1, paddingBottom: insets.bottom + 24 }}
                    className="relative"
                    onLayout={(e) => {
                        e.target.measure((x, y, width, height, pageX, pageY) => {
                            parcelZoneRef.current = { x: pageX, y: pageY, width, height };
                        });
                    }}>

                    <View className="flex-1 items-center justify-start pt-16 gap-y-3">
                        <BarcodeViewfinder
                            isDetected={!!trackingNumber}
                            width={210}
                            height={80}
                            style={{ alignSelf: 'center', paddingTop: insets.top}}
                        />
                    </View>

                    {/* Labels — centred in upper portion of parcel zone */}
                    <View className="flex-1 items-center justify-center gap-y-3">
                        {trackingNumber ? (
                            <View className="items-center gap-y-1">
                                <Text className="text-green-400 text-sm font-bold">{trackingNumber}</Text>
                                <TouchableOpacity onPress={handleRescan}>
                                    <Text className="text-yellow-400 text-xs underline">Rescan</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text className="text-white/60 text-xs">Point at Code 128 barcode</Text>
                        )}
                    </View>

                    {/* Capture button — pinned to bottom */}
                    <View className="items-center gap-y-2">
                        <TouchableOpacity
                            onPress={handleCapture}
                            disabled={!canCapture || isCapturing}
                            className={`w-20 h-20 rounded-full items-center justify-center ${
                                canCapture && !isCapturing ? 'bg-white' : 'bg-gray-500'
                            }`}
                            activeOpacity={0.8}
                        >
                            {isCapturing ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <View className="w-16 h-16 rounded-full border-4 border-gray-800" />
                            )}
                        </TouchableOpacity>

                        <Text className="text-white text-xs text-center px-6">
                            {!trackingNumber
                                ? 'Scan parcel barcode to unlock capture'
                                : buttonLabel}
                        </Text>
                    </View>

                    {/* Corner brackets of parcel zone frame */}
                    <View className="absolute top-10 left-10 w-8 h-8 border-t-2 border-l-2 border-white/50" />
                    <View className="absolute top-10 right-10 w-8 h-8 border-t-2 border-r-2 border-white/50" />
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

