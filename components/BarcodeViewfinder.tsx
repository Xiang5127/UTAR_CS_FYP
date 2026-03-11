import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from 'react-native-reanimated';

const CORNER_SIZE = 18;
const CORNER_THICKNESS = 3;
const IDLE_COLORS = ['#4285F4', '#FBBC05', '#34A853', '#EA4335'];
const DETECTED_COLOR = '#22c55e';

interface BarcodeViewfinderProps {
    isDetected: boolean;
    width?: number;
    height?: number;
    style?: ViewStyle;
}

export default function BarcodeViewfinder({
                                              isDetected,
                                              width = 220,
                                              height = 110,
                                              style,
                                          }: BarcodeViewfinderProps) {
    const scanX = useSharedValue(0);
    const boxScale = useSharedValue(1);
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (!isDetected) {
            // Reset
            boxScale.value = withTiming(1, { duration: 200 });
            pulse.value = withRepeat(
                withSequence(
                    withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                false
            );
            // Scan line left to right
            scanX.value = 0;
            scanX.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                false
            );
        } else {
            // Lock-on: shrink the box, stop pulse, stop scan line
            boxScale.value = withSequence(
                withTiming(0.75, { duration: 200, easing: Easing.out(Easing.ease) }),
                withTiming(0.82, { duration: 100 })
            );
            pulse.value = withTiming(1, { duration: 150 });
        }
    }, [isDetected]);

    // Each corner animated style
    const topLeftStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        top: 0,
        left: 0,
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderTopWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
        borderColor: isDetected ? DETECTED_COLOR : IDLE_COLORS[0],
        borderTopLeftRadius: 3,
        opacity: pulse.value,
    }));

    const topRightStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        top: 0,
        right: 0,
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderTopWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
        borderColor: isDetected ? DETECTED_COLOR : IDLE_COLORS[1],
        borderTopRightRadius: 3,
        opacity: pulse.value,
    }));

    const bottomLeftStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderBottomWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
        borderColor: isDetected ? DETECTED_COLOR : IDLE_COLORS[2],
        borderBottomLeftRadius: 3,
        opacity: pulse.value,
    }));

    const bottomRightStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderBottomWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
        borderColor: isDetected ? DETECTED_COLOR : IDLE_COLORS[3],
        borderBottomRightRadius: 3,
        opacity: pulse.value,
    }));

    const scanLineStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: scanX.value * (width - 2),
        top: 0,
        width: 2,
        height: height,
        backgroundColor: DETECTED_COLOR,
        opacity: 0.7,
    }));

    const boxStyle = useAnimatedStyle(() => ({
        width,
        height,
        transform: [{ scale: boxScale.value }],
    }));

    return (
        <View style={ [{ width, height, alignItems: 'center', justifyContent: 'center' }, style] }>
            <Animated.View style={boxStyle}>
                <Animated.View style={topLeftStyle} />
                <Animated.View style={topRightStyle} />
                <Animated.View style={bottomLeftStyle} />
                <Animated.View style={bottomRightStyle} />
                {!isDetected && <Animated.View style={scanLineStyle} />}
            </Animated.View>
        </View>
    );
}