/**
 * Hook that derives a traffic-light accuracy signal from a raw GPS accuracy value.
 * Centralises all accuracy-state logic away from the camera UI.
 */
export type AccuracySignal = 'green' | 'yellow' | 'red';

export interface AccuracySignalResult {
    signal: AccuracySignal;
    badgeColor: string;
    badgeText: string;
    buttonLabel: string;
    isGreen: boolean;
}

export function useAccuracySignal(
    accuracy: number | null,
    forceCaptureEnabled: boolean
): AccuracySignalResult {
    const signal: AccuracySignal =
        accuracy !== null && accuracy <= 10
            ? 'green'
            : accuracy !== null && accuracy <= 50
                ? 'yellow'
                : 'red';

    const isGreen = signal === 'green';

    const badgeColor =
        signal === 'green' ? '#22c55e' : signal === 'yellow' ? '#eab308' : '#ef4444';

    const badgeText =
        accuracy === null
            ? 'GPS: -- (No Fix)'
            : isGreen
                ? `GPS: ${accuracy.toFixed(1)}m ✓`
                : `GPS: ${accuracy.toFixed(1)}m`;

    const buttonLabel = isGreen
        ? 'Verified Capture'
        : forceCaptureEnabled
            ? 'Force Capture (Low Accuracy)'
            : 'Improving Accuracy...';

    return { signal, badgeColor, badgeText, buttonLabel, isGreen };
}