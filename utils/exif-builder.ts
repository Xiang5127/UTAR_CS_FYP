import { EXIFMetadata } from '@/types/exif.types';
import { LocationCoordinate } from '@/types/location.types';

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function toExifDateTime(date: Date): string {
    return (
        `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

function toGpsDateStamp(date: Date): string {
    return `${date.getUTCFullYear()}:${pad(date.getUTCMonth() + 1)}:${pad(date.getUTCDate())}`;
}

function toGpsTimeStamp(date: Date): string {
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * Builds a complete EXIFMetadata object from a LocationCoordinate snapshot.
 * GPS date/time fields are in UTC per EXIF spec; DateTimeOriginal is local device time.
 */
export function buildExifFromCoordinate(coordinate: LocationCoordinate): EXIFMetadata {
    const capturedAt = new Date(coordinate.timestamp);
    const exifDateTime = toExifDateTime(capturedAt);

    return {
        GPSLatitude: coordinate.latitude,
        GPSLongitude: coordinate.longitude,
        GPSAltitude: coordinate.altitude ?? undefined,
        GPSAltitudeRef: coordinate.altitude !== null && coordinate.altitude < 0 ? 1 : 0,
        GPSDateStamp: toGpsDateStamp(capturedAt),
        GPSTimeStamp: toGpsTimeStamp(capturedAt),
        DateTimeOriginal: exifDateTime,
        DateTimeDigitized: exifDateTime,
        DateTime: exifDateTime,
    };
}
