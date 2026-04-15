import { useCallback, useRef, useState } from 'react';
import { Code, CodeScanner, CodeType, useCodeScanner } from 'react-native-vision-camera';

import { BarcodeScanResult, BarcodeScannerState } from '../types/camera.types';

export interface UseBarcodeScannerReturn extends BarcodeScannerState {
    codeScanner: CodeScanner;
    resetScan: () => void;
}

const REQUIRED_STABLE_COUNT = 4;
const SUPPORTED_CODE_TYPES: CodeType[] = ['code-128'];

/**
 * Hook for barcode scanning with react-native-vision-camera.
 * Includes debounce/stability logic for reliable Code128 detection.
 */
export function useBarcodeScanner(): UseBarcodeScannerReturn {
    const lastScannedDataRef = useRef<string | null>(null);
    const stableCountRef = useRef(0);
    const isLockedRef = useRef(false);
    const [scanResult, setScanResult] = useState<BarcodeScanResult | null>(null);

    const handleCodeScanned = useCallback((codes: Code[]) => {
        // Dual-Track: Ref for logic (synchronous, no stale closure)
        if (isLockedRef.current) return;

        for (const code of codes) {
            // Only process Code 128 barcodes
            if (code.type !== 'code-128' || !code.value) {
                continue;
            }

            const corners = code.corners?.map((corner) => ({
                x: corner.x,
                y: corner.y,
            })) ?? [];

            // If same data as last frame, increment stable count
            if (code.value === lastScannedDataRef.current) {
                stableCountRef.current += 1;

                // Only lock in once we have enough stable consecutive readings
                if (stableCountRef.current >= REQUIRED_STABLE_COUNT) {
                    // Dual-Track: Lock immediately with ref (prevents multiple fires)
                    isLockedRef.current = true;
                    // Dual-Track: Update state for UI re-render
                    setScanResult({
                        value: code.value,
                        type: code.type,
                        corners,
                    });
                    return;
                }
            } else {
                // Different data — reset count, store new candidate
                lastScannedDataRef.current = code.value;
                stableCountRef.current = 1;
            }
        }
    }, []); // Empty deps = stable callback, no re-initialization

    const codeScanner = useCodeScanner({
        codeTypes: SUPPORTED_CODE_TYPES,
        onCodeScanned: handleCodeScanned,
    });

    const resetScan = useCallback(() => {
        // Dual-Track: Reset both ref (logic) and state (UI)
        lastScannedDataRef.current = null;
        stableCountRef.current = 0;
        isLockedRef.current = false;
        setScanResult(null);
    }, []);

    const isScanning = !scanResult;

    return {
        scanResult,
        corners: scanResult?.corners ?? null,
        isScanning,
        codeScanner,
        resetScan,
    };
}
