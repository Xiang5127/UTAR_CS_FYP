import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { BuildingDetectorConfig, BuildingDetectorResult } from '../types/detector.types';

// ── Default model asset ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DEFAULT_MODEL = require('../../../assets/model/model_firstbatch_terrace/model.tflite');

// ── Default config values ──────────────────────────────────────────────
const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_INPUT_SIZE = 224;
const DEFAULT_FRAME_SKIP = 10;

/**
 * Hook that runs a TFLite building-detection model on live camera frames.
 *
 * Designed for easy model swapping:
 * ```ts
 * // Default model
 * const detector = useBuildingDetector();
 *
 * // Custom model / threshold
 * const detector = useBuildingDetector({
 *   model: require('@/assets/model/model_v2/model.tflite'),
 *   threshold: 0.75,
 * });
 * ```
 *
 * @returns BuildingDetectorResult + frameProcessor to pass to <Camera>
 */
export function useBuildingDetector(
    config?: BuildingDetectorConfig
): BuildingDetectorResult & { frameProcessor: ReturnType<typeof useFrameProcessor> } {
    const {
        model: modelSource = DEFAULT_MODEL,
        threshold = DEFAULT_THRESHOLD,
        inputSize = DEFAULT_INPUT_SIZE,
        frameSkip = DEFAULT_FRAME_SKIP,
    } = config ?? {};

    // ── State ──────────────────────────────────────────────────────────
    const [confidence, setConfidence] = useState(0);
    const [isBuildingDetected, setIsBuildingDetected] = useState(false);

    // ── Resolve asset → load model (two-phase, fixes Android standalone) ─
    // require() returns a numeric asset ID. react-native-fast-tflite's
    // internal Image.resolveAssetSource() produces a protocol-less path on
    // Android production builds → native MalformedURLException crash.
    // Phase 1: expo-asset resolves the bundled .tflite to a file:// URI.
    // Phase 2: loadTensorflowModel (imperative) loads from that URI.
    // This guarantees we NEVER pass the raw require() number to TFLite.
    const [model, setModel] = useState<TfliteModel | null>(null);
    const [modelState, setModelState] = useState<'loading' | 'loaded' | 'error'>('loading');
    const [modelError, setModelError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setModelState('loading');
        setModelError(null);

        Asset.loadAsync(modelSource)
            .then(([asset]) => {
                if (cancelled || !asset.localUri) return;
                return loadTensorflowModel({ url: asset.localUri }, []);
            })
            .then((loaded) => {
                if (cancelled || !loaded) return;
                setModel(loaded);
                setModelState('loaded');
            })
            .catch((e) => {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : String(e);
                console.error('[BuildingDetector] Model load failed:', msg);
                setModelError(msg);
                setModelState('error');
            });

        return () => {
            cancelled = true;
        };
    }, [modelSource]);

    // Workaround for VisionCamera v4 worklets not natively supporting jsi::NativeState.
    // We "box" the HybridObject before it enters the worklet, and "unbox" it inside.
    const boxedModel = model ? NitroModules.box(model) : undefined;

    // ── Resize plugin (runs on worklet thread) ─────────────────────────
    const { resize } = useResizePlugin();

    // ── Frame counter for throttling (shared value works in worklets) ──
    const frameCount = useSharedValue(0);

    // ── JS callback (receives results from worklet) ────────────────────
    const thresholdRef = useRef(threshold);
    thresholdRef.current = threshold;

    const onDetectionResult = useCallback((conf: number) => {
        setConfidence(conf);
        setIsBuildingDetected(conf >= thresholdRef.current);
    }, []);

    // Wrap the JS callback so it can be called from worklet thread
    const runOnJS = Worklets.createRunOnJS(onDetectionResult);

    // ── Frame processor (worklet thread) ───────────────────────────────
    const frameProcessor = useFrameProcessor(
        (frame) => {
            'worklet';

            // Only run when model is loaded
            if (boxedModel == null) return;

            // Unbox the model inside the worklet to safely restore the NativeState
            const model = boxedModel.unbox();

            // Throttle: only run every Nth frame
            frameCount.value = frameCount.value + 1;
            if (frameCount.value % frameSkip !== 0) return;

            const resized = resize(frame, {
                scale: { width: inputSize, height: inputSize },
                pixelFormat: 'rgb',
                dataType: 'uint8',
            });

            // model.runSync expects ArrayBuffer[], returns ArrayBuffer[]
            const outputs = model.runSync([resized.buffer as ArrayBuffer]);

            // Output: uint8[1,2] — [not-building, building], quantized: float = 0.00390625 * q
            const outputBuffer = outputs[0];
            const scores = new Uint8Array(outputBuffer);
            const conf = Math.max(0, Math.min(1, scores[1] * 0.00390625));
            runOnJS(conf);
        },
        [boxedModel, resize, inputSize, frameSkip, frameCount, runOnJS]
    );

    return {
        confidence,
        isBuildingDetected,
        isModelReady: modelState === 'loaded',
        isModelLoading: modelState === 'loading',
        modelError,
        frameProcessor,
    };
}

export type { BuildingDetectorConfig, BuildingDetectorResult };
