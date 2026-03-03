import { EXIFMetadata } from '@/types/exif.types';

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
    verificationMethod: 'precise' | 'override';
}

/**
 * Send capture payload to API.
 * Currently logs to console — replace with Appwrite/WhatsApp call in Phase 2.
 */
export function sendToAPI(payload: CapturePayload): void {
    console.log('📸 Capture Payload:', JSON.stringify(payload, null, 2));
    // TODO: Replace with actual API call
    // await fetch('https://api.example.com/capture', {
    //   method: 'POST',
    //   body: JSON.stringify(payload),
    // });
}