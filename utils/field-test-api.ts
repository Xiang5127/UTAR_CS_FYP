import { hashImageFile } from '@/utils/hasher';
import { supabase } from '@/utils/supabase_client';
import * as FileSystem from 'expo-file-system/legacy';

export interface FieldTestPayload {
    // Production parity
    photoUri: string;
    location: {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        altitude: number | null;
        timestamp: number;
        speed: number | null;
        heading: number | null;
    };
    accuracyStatus: 'precise' | 'override';
    trackingNumber: string;

    // Model diagnostics
    modelConfidence: number;
    buildingDetected: boolean;
    detectionOverridden: boolean;

    // Ground truth
    groundTruthIsBuilding: boolean | null;

    // Timing (all in ms)
    barcodeScanMs: number | null;
    gpsFixMs: number | null;
    timeToCaptureMs: number | null;
    exifWriteMs: number | null;

    // Device state
    batteryLevel: number | null;
}

/**
 * Uploads image to Supabase Storage (field-test-proofs bucket),
 * computes image hash, inserts a field test record, and returns
 * the measured upload latency.
 */
export async function sendToFieldTestAPI(
    payload: FieldTestPayload
): Promise<{ uploadLatencyMs: number; success: boolean }> {
    const uploadStart = Date.now();

    try {
        // 1) Compute image hash for integrity verification
        const imageHash = await hashImageFile(payload.photoUri);

        // 2) Read image as base64 and upload to Supabase Storage
        const fileBase64 = await FileSystem.readAsStringAsync(payload.photoUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        const fileName = `field_test_${Date.now()}.jpg`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('field-test-proofs')
            .upload(fileName, decode(fileBase64), {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (storageError) {
            console.error('[FieldTest] Storage upload failed:', storageError.message);
            return { uploadLatencyMs: Date.now() - uploadStart, success: false };
        }

        // 3) Get public URL
        const { data: urlData } = supabase.storage
            .from('field-test-proofs')
            .getPublicUrl(storageData.path);
        const imageUrl = urlData.publicUrl;

        // 4) Insert field test record
        const { error } = await supabase.from('field_test_records').insert({
            // Production parity
            image_url: imageUrl,
            image_hash: imageHash,
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            altitude: payload.location.altitude,
            gps_accuracy_metres: payload.location.accuracy,
            captured_at: new Date(payload.location.timestamp).toISOString(),
            accuracy_status: payload.accuracyStatus,
            tracking_number: payload.trackingNumber,

            // Model diagnostics
            model_confidence: payload.modelConfidence,
            building_detected: payload.buildingDetected,
            detection_overridden: payload.detectionOverridden,

            // Ground truth
            ground_truth_is_building: payload.groundTruthIsBuilding,

            // Timing
            barcode_scan_ms: payload.barcodeScanMs,
            gps_fix_ms: payload.gpsFixMs,
            time_to_capture_ms: payload.timeToCaptureMs,
            exif_write_ms: payload.exifWriteMs,
            upload_latency_ms: null, // Will be updated after insert resolves
            upload_success: true,

            // Device state
            battery_level: payload.batteryLevel,

            // Path-view support
            gps_speed: payload.location.speed,
            gps_heading: payload.location.heading,
        });

        const uploadLatencyMs = Date.now() - uploadStart;

        if (error) {
            console.error('[FieldTest] DB insert failed:', error.message);
            return { uploadLatencyMs, success: false };
        }

        // Update the record with the actual upload latency
        // Best-effort; not critical if this fails
        await supabase
            .from('field_test_records')
            .update({ upload_latency_ms: uploadLatencyMs })
            .eq('image_hash', imageHash)
            .eq('tracking_number', payload.trackingNumber)
            .single();

        console.log(`[FieldTest] Record saved (${uploadLatencyMs}ms)`);
        return { uploadLatencyMs, success: true };
    } catch (error) {
        const uploadLatencyMs = Date.now() - uploadStart;
        console.error('[FieldTest] sendToFieldTestAPI failed:', error);
        return { uploadLatencyMs, success: false };
    }
}

/**
 * Decodes a base64 string into a Uint8Array for Supabase Storage upload.
 */
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
