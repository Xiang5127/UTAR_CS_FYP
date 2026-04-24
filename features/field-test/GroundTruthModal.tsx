import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GroundTruthModalProps {
    visible: boolean;
    confidence: number;
    onResponse: (isBuilding: boolean) => void;
}

/**
 * Quick 1-tap annotation modal shown after capture in field-test mode.
 * Records ground truth for confusion-matrix analysis.
 */
export const GroundTruthModal: React.FC<GroundTruthModalProps> = ({
    visible,
    confidence,
    onResponse,
}) => (
    <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
            <View style={styles.card}>
                <Text style={styles.title}>Ground Truth Annotation</Text>
                <Text style={styles.subtitle}>
                    Model confidence: {(confidence * 100).toFixed(1)}% — Is there a building in this
                    photo?
                </Text>

                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        onPress={() => onResponse(true)}
                        style={[styles.button, { backgroundColor: '#16A34A' }]}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.buttonText}>Yes, Building</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => onResponse(false)}
                        style={[styles.button, { backgroundColor: '#DC2626' }]}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.buttonText}>No Building</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        backgroundColor: '#111827',
        borderRadius: 16,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 24,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 16,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
