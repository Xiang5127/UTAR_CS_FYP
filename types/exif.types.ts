/**
 * EXIF metadata TypeScript interfaces
 */

export interface EXIFMetadata {
    // Date/Time
    DateTimeOriginal?: string;
    DateTimeDigitized?: string;
    DateTime?: string;

    // GPS
    GPSLatitude?: number;
    GPSLongitude?: number;
    GPSAltitude?: number;
    GPSAltitudeRef?: number;
    GPSHeading?: number;
    GPSSpeed?: number;
    GPSDateStamp?: string;
    GPSTimeStamp?: string;

    // Camera settings
    Make?: string;
    Model?: string;
    Orientation?: number;
    XResolution?: number;
    YResolution?: number;
    ResolutionUnit?: number;

    // Image properties
    ImageWidth?: number;
    ImageHeight?: number;
    ColorSpace?: number;
    PixelXDimension?: number;
    PixelYDimension?: number;

    // Exposure
    ExposureTime?: number;
    FNumber?: number;
    ExposureProgram?: number;
    ISOSpeedRatings?: number;
    ExposureBiasValue?: number;
    MeteringMode?: number;
    Flash?: number;

    // Focal length
    FocalLength?: number;
    FocalLengthIn35mmFilm?: number;

    // White balance
    WhiteBalance?: number;

    // Other
    Software?: string;
    Artist?: string;
    Copyright?: string;
}

export interface EXIFProcessingResult {
    success: boolean;
    metadata: EXIFMetadata | null;
    error?: string;
}
