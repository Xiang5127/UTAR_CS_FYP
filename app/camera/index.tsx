import * as Battery from 'expo-battery';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    BarcodeViewfinder,
    CameraView,
    useAccuracySignal,
    useBarcodeScanner,
    useBuildingDetector,
    useCameraCapture,
    useCameraPermissions,
    useLocationWatcher,
} from '@/features/camera';
import { FieldTestBanner, GroundTruthModal, useFieldTest } from '@/features/field-test';
import { EXIFMetadata } from '@/types';
import { CapturePayload, sendToAPI } from '@/utils/api';
import { buildExifFromCoordinate } from '@/utils/exif-builder';
import { burnExifOnly, saveToGalleryOnly } from '@/utils/exif-processor';
import { FieldTestPayload, sendToFieldTestAPI } from '@/utils/field-test-api';

export default function CameraScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { permission, requestPermission } = useCameraPermissions();
    const [isCapturing, setIsCapturing] = useState(false);
    const [forceCaptureEnabled, setForceCaptureEnabled] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Field Test Mode ──
    const { isTestMode, toggleTestMode } = useFieldTest();
    const tapCountRef = useRef(0);
    const lastTapTimeRef = useRef(0);
    const screenMountTime = useRef(Date.now());
    const barcodeScanStartRef = useRef(Date.now());
    const barcodeDetectedAtRef = useRef<number | null>(null);
    const gpsReadyAtRef = useRef<number | null>(null);
    const [groundTruthVisible, setGroundTruthVisible] = useState(false);
    const groundTruthResolverRef = useRef<((value: boolean) => void) | null>(null);

    // Barcode scanning
    const { scanResult, codeScanner, resetScan } = useBarcodeScanner();
    const trackingNumber = scanResult?.value ?? null;

    // Track the parcel zone's position on screen
    const parcelZoneRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
        null
    );

    // Location and camera
    const { coordinate, error, latestCoordinateRef } = useLocationWatcher();
    const { cameraRef, device, format, capturePhoto } = useCameraCapture(latestCoordinateRef);

    // Building detection (TFLite model via frame processor)
    const {
        confidence,
        isBuildingDetected,
        isModelReady,
        isModelLoading,
        modelError,
        frameProcessor,
    } = useBuildingDetector();

    const location = coordinate;
    const errorMsg = error?.message ?? null;
    const accuracy = coordinate?.accuracy ?? null;

    const { badgeColor, badgeText, buttonLabel, isGreen } = useAccuracySignal(
        accuracy,
        forceCaptureEnabled
    );

    // Capture button requires barcode scanned AND GPS ready AND (in prod) building detected
    const canCapture =
        !!location &&
        !!trackingNumber &&
        (isGreen || forceCaptureEnabled) &&
        (isTestMode || isBuildingDetected);

    // Fallback Timer Logic: start 5s timer on mount if not Green; clear upon Green
    useEffect(() => {
        const clearTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
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

        return () => {
            clearTimer();
        };
    }, [isGreen]);

    // ── Field Test: Timing trackers ──
    useEffect(() => {
        if (trackingNumber && !barcodeDetectedAtRef.current) {
            barcodeDetectedAtRef.current = Date.now();
        }
        if (!trackingNumber) {
            barcodeScanStartRef.current = Date.now();
            barcodeDetectedAtRef.current = null;
        }
    }, [trackingNumber]);

    // Track when GPS becomes usable (green OR force-capture timer fired)
    useEffect(() => {
        if ((isGreen || forceCaptureEnabled) && !gpsReadyAtRef.current) {
            gpsReadyAtRef.current = Date.now();
        }
    }, [isGreen, forceCaptureEnabled]);

    const handleTripleTap = () => {
        const now = Date.now();
        if (now - lastTapTimeRef.current > 800) {
            tapCountRef.current = 0;
        }
        tapCountRef.current += 1;
        lastTapTimeRef.current = now;
        if (tapCountRef.current >= 3) {
            toggleTestMode();
            tapCountRef.current = 0;
        }
    };

    const requestGroundTruth = (): Promise<boolean> =>
        new Promise((resolve) => {
            groundTruthResolverRef.current = resolve;
            setGroundTruthVisible(true);
        });

    const handleGroundTruthResponse = (isBuilding: boolean) => {
        groundTruthResolverRef.current?.(isBuilding);
        groundTruthResolverRef.current = null;
        setGroundTruthVisible(false);
    };

    const handleRescan = () => {
        resetScan();
    };

    const handleCapture = async () => {
        if (!canCapture || !cameraRef.current) {
            alert('Camera, location, or barcode not ready.');
            console.log('Error in handleCapture: Not available or not allowed by accuracy state');
            return;
        }

        try {
            setIsCapturing(true);

            // 1) Capture photo
            const photo = await capturePhoto();

            // 2) Build EXIF metadata from current location snapshot
            const exifMetadata: EXIFMetadata = buildExifFromCoordinate(location);

            // 3) Burn EXIF into temp file — timed for field test metrics
            let exifUri = photo.uri;
            let exifWriteMs: number | null = null;
            try {
                const t0 = Date.now();
                const written = await burnExifOnly(photo.uri, exifMetadata);
                exifUri = written.uri;
                exifWriteMs = Date.now() - t0;
            } catch (e) {
                console.warn('Failed to write EXIF:', e);
            }

            // 4) Save to gallery in foreground
            await saveToGalleryOnly(exifUri, 'Streamline');

            if (isTestMode) {
                // ── Field Test Flow ──
                const groundTruth = await requestGroundTruth();

                const fieldPayload: FieldTestPayload = {
                    photoUri: exifUri,
                    location: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        accuracy: location.accuracy,
                        altitude: location.altitude,
                        timestamp: location.timestamp,
                        speed: location.speed,
                        heading: location.heading,
                    },
                    accuracyStatus: isGreen ? 'precise' : 'override',
                    trackingNumber: trackingNumber!,
                    modelConfidence: confidence,
                    buildingDetected: isBuildingDetected,
                    detectionOverridden: !isBuildingDetected,
                    groundTruthIsBuilding: groundTruth,
                    barcodeScanMs: barcodeDetectedAtRef.current
                        ? barcodeDetectedAtRef.current - barcodeScanStartRef.current
                        : null,
                    gpsFixMs: gpsReadyAtRef.current
                        ? gpsReadyAtRef.current - screenMountTime.current
                        : null,
                    timeToCaptureMs: barcodeDetectedAtRef.current
                        ? Date.now() - barcodeDetectedAtRef.current
                        : null,
                    exifWriteMs,
                    batteryLevel: await Battery.getBatteryLevelAsync(),
                };

                sendToFieldTestAPI(fieldPayload).catch((e) => {
                    console.warn('[FieldTest] Background upload failed:', e);
                });

                await Share.share({
                    message: [
                        `Delivery Confirmed`,
                        ``,
                        `Tracking: ${trackingNumber}`,
                        `Time: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`,
                        ``,
                        `View Proof of Delivery:`,
                        `https://streamline-pod-landing-page.vercel.app/delivery?id=${trackingNumber}`,
                    ].join('\n'),
                });
            } else {
                // ── Normal Production Flow ──
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

                Alert.alert('Success', 'Photo captured, EXIF written, and saved to gallery!');

                await Share.share({
                    message: [
                        `Delivery Confirmed`,
                        ``,
                        `Tracking: ${trackingNumber}`,
                        `Time: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}`,
                        ``,
                        `View Proof of Delivery:`,
                        `https://streamline-pod-landing-page.vercel.app/delivery?id=${trackingNumber}`,
                    ].join('\n'),
                });

                sendToAPI(payload).catch((e) => {
                    console.warn('Background upload failed:', e);
                });
            }
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
                    className="bg-blue-500 px-6 py-3 rounded-lg"
                >
                    <Text className="text-white font-semibold">Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-black">
            {/* Full screen camera view */}
            <CameraView
                cameraRef={cameraRef}
                device={device}
                format={format}
                isActive={true}
                codeScanner={!trackingNumber ? codeScanner : undefined}
                frameProcessor={trackingNumber ? frameProcessor : undefined}
            />

            {/* Overlay split into top and bottom halves with a middle separator line */}
            <View className="absolute inset-0" pointerEvents="box-none">
                {/* Top Half */}
                <View style={{ flex: 1, paddingTop: insets.top + 8 }} className="relative">
                    {/* Optional Border UI */}
                    <View className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-white/50" />
                    <View className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-white/50" />

                    {/* Field Test Banner */}
                    {isTestMode && <FieldTestBanner />}

                    {/* GPS meter tracker — triple-tap to toggle field test mode */}
                    <TouchableOpacity onPress={handleTripleTap} activeOpacity={1}>
                    <View className="mx-4">
                        {errorMsg ? (
                            <View className="bg-red-500 px-4 py-2 rounded-lg">
                                <Text className="text-white text-sm font-semibold">{errorMsg}</Text>
                            </View>
                        ) : (
                            <View
                                style={{ backgroundColor: badgeColor }}
                                className="px-4 py-2 rounded-lg self-start"
                            >
                                <Text className="text-white text-sm font-semibold">
                                    {badgeText}
                                </Text>
                            </View>
                        )}
                    </View>
                    </TouchableOpacity>

                    {/* DEBUG: Building detection overlay */}
                    <View className="mx-4 mt-2">
                        <View
                            style={{
                                backgroundColor: isModelLoading
                                    ? '#6B7280'
                                    : modelError
                                      ? '#EF4444'
                                      : isBuildingDetected
                                        ? '#22C55E'
                                        : '#F97316',
                            }}
                            className="px-4 py-2 rounded-lg self-start"
                        >
                            <Text className="text-white text-sm font-semibold">
                                {isModelLoading
                                    ? 'Model loading...'
                                    : modelError
                                      ? `Model error: ${modelError}`
                                      : `Building: ${(confidence * 100).toFixed(1)}% ${isBuildingDetected ? '\u2713' : '\u2717'}`}
                            </Text>
                        </View>
                    </View>

                    {/* Visual Guide Label (Centered in Top Half) */}
                    <View className="absolute inset-0 items-center justify-center pointer-events-none">
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
                        e.target.measure?.((x, y, width, height, pageX, pageY) => {
                            parcelZoneRef.current = { x: pageX, y: pageY, width, height };
                        });
                    }}
                >
                    <View className="flex-1 items-center justify-start pt-16 gap-y-3">
                        <BarcodeViewfinder
                            isDetected={!!trackingNumber}
                            width={210}
                            height={80}
                            style={{ alignSelf: 'center', paddingTop: insets.top }}
                        />
                    </View>

                    {/* Labels — centred in upper portion of parcel zone */}
                    <View className="flex-1 items-center justify-center gap-y-3">
                        {trackingNumber ? (
                            <View className="items-center gap-y-1">
                                <Text className="text-green-400 text-sm font-bold">
                                    {trackingNumber}
                                </Text>
                                <TouchableOpacity onPress={handleRescan}>
                                    <Text className="text-yellow-400 text-xs underline">
                                        Rescan
                                    </Text>
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

            {/* Ground truth annotation modal (field test only) */}
            <GroundTruthModal
                visible={groundTruthVisible}
                confidence={confidence}
                onResponse={handleGroundTruthResponse}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    separatorLine: {
        height: 2,
        width: '90%',
        backgroundColor: '#FACC15',
        opacity: 0.8,
        flexDirection: 'row',
        alignSelf: 'center',
        justifyContent: 'center',
    },
});
