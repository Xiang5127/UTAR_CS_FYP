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
    forceCaptureLabel: string;
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
        signal === 'green'
            ? 'bg-green-500'
            : signal === 'yellow'
                ? 'bg-yellow-500'
                : 'bg-red-500';

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

    return {
        signal,
        badgeColor,
        badgeText,
        buttonLabel,
        isGreen,
        forceCaptureLabel: buttonLabel,
    };
}