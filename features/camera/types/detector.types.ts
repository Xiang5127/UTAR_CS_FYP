/**
 * Building detector types — modular config for TFLite model inference
 */

export interface BuildingDetectorConfig {
    /** TFLite model source via require('…/model.tflite'). Defaults to first-batch terrace model. */
    model?: number;
    /** Confidence threshold to consider a building detected (0–1). Default: 0.80 */
    threshold?: number;
    /** Model input square size in px. Default: 224 */
    inputSize?: number;
    /** Run inference every Nth frame to save resources. Default: 10 */
    frameSkip?: number;
}

export interface BuildingDetectorResult {
    /** Raw confidence score from the model (0–1) */
    confidence: number;
    /** Whether confidence ≥ threshold */
    isBuildingDetected: boolean;
    /** Model has finished loading and is ready for inference */
    isModelReady: boolean;
    /** Model is currently loading */
    isModelLoading: boolean;
    /** Error message if model failed to load */
    modelError: string | null;
}
