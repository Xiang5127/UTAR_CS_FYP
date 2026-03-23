import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase_client';

export default function HomeScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // FOR TESTING PURPOSE:
    // useEffect(() => {
    //     fetch('https://hbvayzayhqqunkvgrwza.supabase.co')
    //         .then((res) => console.log('✅ Fetch test passed:', res.status))
    //         .catch((err) => console.log('❌ Fetch test failed:', err.message));
    // }, []);
    //
    // useEffect(() => {
    //     supabase
    //         .from('delivery_records')
    //         .select('id')
    //         .limit(1)
    //         .then(({ data, error }) => {
    //             if (error) console.log('❌ DB test failed:', error.message);
    //             else console.log('✅ DB test passed:', data);
    //         });
    // }, []);

    return (
        <View
            className="flex-1 items-center justify-center bg-white"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            <View className="px-6 items-center">
                <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                    Streamline
                </Text>
                <Text className="text-gray-600 mb-8 text-center">
                    Capture photos with GPS and EXIF metadata
                </Text>

                <TouchableOpacity
                    onPress={() => router.push('/camera')}
                    className="bg-blue-500 px-8 py-4 rounded-lg shadow-lg active:bg-blue-600"
                >
                    <Text className="text-white text-lg font-semibold">Start Capturing</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
