import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { LocationCoordinate, LocationWatcherState } from '@/types/location.types';

export interface UseLocationWatcherReturn extends LocationWatcherState {
    latestCoordinateRef: { current: LocationCoordinate | null };
}

/**
 * Custom hook for watching GPS position with BestForNavigation accuracy.
 *
 * "Secret Sauce" Strategy:
 * - Uses watchPositionAsync (not getCurrentPositionAsync) for warm-up
 * - Stores latest coordinate in ref for immediate snapshot access
 * - BestForNavigation accuracy for maximum precision
 *
 * @returns LocationWatcherState with coordinate, loading, error, isWatching status, and ref for snapshot access
 */
export function useLocationWatcher(): UseLocationWatcherReturn {
    const [state, setState] = useState<LocationWatcherState>({
        coordinate: null,
        isLoading: true,
        error: null,
        isWatching: false,
    });

    // Ref to store latest coordinate for immediate snapshot access
    const latestCoordinateRef = useRef<LocationCoordinate | null>(null);
    const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

    async function startWatching(isMounted: boolean) {
        try {
            // Request permissions
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (!isMounted) return;

            if (status !== 'granted') {
                setState({
                    coordinate: null,
                    isLoading: false,
                    error: new Error('Location permission not granted'),
                    isWatching: false,
                });
                return;
            }

            // Start watching position with BestForNavigation accuracy
            const subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000, // Update every second
                    distanceInterval: 1, // Update every meter
                },
                (location) => {
                    if (!isMounted) return;

                    const coordinate: LocationCoordinate = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        accuracy: location.coords.accuracy,
                        altitude: location.coords.altitude ?? null,
                        altitudeAccuracy: location.coords.altitudeAccuracy ?? null,
                        heading: location.coords.heading ?? null,
                        speed: location.coords.speed ?? null,
                        timestamp: location.timestamp,
                    };

                    // Update ref immediately for snapshot access
                    latestCoordinateRef.current = coordinate;

                    // Update state
                    setState({
                        coordinate,
                        isLoading: false,
                        error: null,
                        isWatching: true,
                    });
                }
            );

            if (!isMounted) {
                subscription.remove();
                return;
            }

            subscriptionRef.current = subscription;
        } catch (error) {
            if (!isMounted) return;

            setState({
                coordinate: null,
                isLoading: false,
                error:
                    error instanceof Error ? error : new Error('Failed to start location watcher'),
                isWatching: false,
            });
        }
    }

    useEffect(() => {
        let isMounted = true;

        startWatching(isMounted);

        // Cleanup on unmount
        return () => {
            isMounted = false;
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
                subscriptionRef.current = null;
            }
        };
    }, []);

    return {
        ...state,
        latestCoordinateRef,
    };
}
