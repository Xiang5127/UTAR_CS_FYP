/**
 * Location-related TypeScript interfaces for GPS coordinate handling
 */

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationWatcherOptions {
  accuracy?: 'lowest' | 'low' | 'balanced' | 'high' | 'highest' | 'bestForNavigation';
  timeInterval?: number;
  distanceInterval?: number;
}

export interface LocationWatcherState {
  coordinate: LocationCoordinate | null;
  isLoading: boolean;
  error: Error | null;
  isWatching: boolean;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

