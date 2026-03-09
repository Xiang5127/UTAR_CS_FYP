import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolateColor,
} from 'react-native-reanimated';

interface BarcodeViewfinderProps {
    isDetected: boolean;
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;
const VIEWFINDER_SIZE = 200;

/**
 * Animated barcode viewfinder with four corner brackets.
 * - Idle: corners pulse opacity to indicate scanning in progress
 * - Detected: corners turn green and scale up to confirm lock
 */
export default function BarcodeViewfinder({ isDetected }: BarcodeViewfinderProps) {
    const pulse = useSharedValue(1);
    const scale = useSharedValue(1);
    const colorProgress = useSharedValue(0);

    // Idle pulse animation — runs continuously until detected
    useEffect(() => {
        if (!isDetected) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
                ),
                -1, // repeat forever
                false
            );
            scale.value = withTiming(1, { duration: 200 });
            colorProgress.value = withTiming(0, { duration: 200 });
        } else {
            // Detected — stop pulse, snap to green with scale pop
            pulse.value = withTiming(1, { duration: 150 });
            scale.value = withSequence(
                withTiming(1.08, { duration: 150, easing: Easing.out(Easing.ease) }),
                withTiming(1, { duration: 150, easing: Easing.in(Easing.ease) })
            );
            colorProgress.value = withTiming(1, { duration: 200 });
        }
    }, [isDetected]);

    const animatedCornerStyle = useAnimatedStyle(() => ({
        opacity: pulse.value,
        transform: [{ scale: scale.value }],
    }));

    const animatedColorStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            colorProgress.value,
            [0, 1],
            ['#ffffff', '#22c55e'] // white → green-500
        ),
    }));

    const cornerStyle = [animatedCornerStyle, animatedColorStyle];

    return (
        <View style={styles.container}>
            {/* Top Left */}
            <Animated.View style={[styles.corner, styles.topLeft, cornerStyle]} />
            {/* Top Right */}
            <Animated.View style={[styles.corner, styles.topRight, cornerStyle]} />
            {/* Bottom Left */}
            <Animated.View style={[styles.corner, styles.bottomLeft, cornerStyle]} />
            {/* Bottom Right */}
            <Animated.View style={[styles.corner, styles.bottomRight, cornerStyle]} />

            {/* Optional center scan line — subtle horizontal line that slides up and down */}
            {!isDetected && <ScanLine />}
        </View>
    );
}

/**
 * Subtle animated scan line that slides vertically inside the viewfinder.
 */
function ScanLine() {
    const translateY = useSharedValue(-60);

    useEffect(() => {
        translateY.value = withRepeat(
            withSequence(
                withTiming(60, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(-60, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View style={[styles.scanLine, animatedStyle]} />
    );
}

const styles = StyleSheet.create({
    container: {
        width: VIEWFINDER_SIZE,
        height: VIEWFINDER_SIZE / 2, // half height since it's in the parcel zone
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: '#ffffff',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
    },
    scanLine: {
        position: 'absolute',
        width: VIEWFINDER_SIZE - 20,
        height: 2,
        backgroundColor: '#22c55e',
        opacity: 0.6,
    },
});