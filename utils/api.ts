import * as FileSystem from 'expo-file-system/legacy';
import { EXIFMetadata } from '@/types/exif.types';
import { supabase } from '@/utils/supabase_client';
import { hashImageFile } from '@/utils/hasher';

export interface CapturePayload {
    photoUri: string;
    location: {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        altitude: number | null;
        timestamp: number;
    };
    exif: EXIFMetadata | null;
    accuracyStatus: 'precise' | 'override';
}

/**
 * Uploads the proof image to Supabase Storage and inserts a delivery record.
 * Also computes a SHA-256 hash of the image for tamper detection.
 */
export async function sendToAPI(payload: CapturePayload): Promise<void> {

    try {
        // 1) Compute image hash for tamper detection
        const imageHash = await hashImageFile(payload.photoUri);

        // 2) Read image file as base64
        const fileBase64 = await FileSystem.readAsStringAsync(payload.photoUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // 3) Upload image to Supabase Storage
        const fileName = `delivery_${Date.now()}.jpg`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('delivery-proofs')
            .upload(fileName, decode(fileBase64), {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

        // 4) Get public URL of uploaded image
        const { data: urlData } = supabase.storage
            .from('delivery-proofs')
            .getPublicUrl(storageData.path);

        const imageUrl = urlData.publicUrl;

        // 5) Insert delivery record into database
        const { error: dbError } = await supabase
            .from('delivery_records')
            .insert({
                image_url: imageUrl,
                image_hash: imageHash,
                latitude: payload.location.latitude,
                longitude: payload.location.longitude,
                altitude: payload.location.altitude,
                gps_accuracy_metres: payload.location.accuracy,
                captured_at: new Date(payload.location.timestamp).toISOString(),
                accuracy_status: payload.accuracyStatus,
            });

        if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);

        console.log('✅ Delivery record saved:', imageUrl);
    } catch (error) {
        console.error('❌ sendToAPI failed:', error);
        throw error;
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