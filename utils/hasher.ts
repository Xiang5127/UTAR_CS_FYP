import * as FileSystem from 'expo-file-system/legacy';
import { sha256 } from 'js-sha256';

/**
 * Computes a SHA-256 hash of a local image file.
 * This hash is stored in the database as a tamper-detection fingerprint.
 * Uses pure JS implementation to avoid native module dependency.
 */
export async function hashImageFile(fileUri: string): Promise<string> {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    return sha256(base64);
}

// import * as FileSystem from 'expo-file-system/legacy';
// import * as Crypto from 'expo-crypto';
//
// /**
//  * Computes a SHA-256 hash of a local image file.
//  * This hash is stored in the database as a tamper-detection fingerprint.
//  */
// export async function hashImageFile(fileUri: string): Promise<string> {
//     const base64 = await FileSystem.readAsStringAsync(fileUri, {
//         encoding: FileSystem.EncodingType.Base64,
//     });
//
//     const hash = await Crypto.digestStringAsync(
//         Crypto.CryptoDigestAlgorithm.SHA256,
//         base64
//     );
//
//     return hash;
// }
