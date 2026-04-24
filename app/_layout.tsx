import { FieldTestProvider } from '@/features/field-test';
import * as MediaLibrary from 'expo-media-library';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

export default function RootLayout() {
    useEffect(() => {
        MediaLibrary.requestPermissionsAsync().then(({ granted }) => {
            console.log('[RootLayout] Media library permission granted:', granted);
        });
    }, []);

    return (
        <FieldTestProvider>
            {/*
            In Expo Router, you simply place a _layout.tsx file inside a folder.
            If that file exports a <Stack />, everything in that folder is a stack.
            If it exports <Tabs />, it's a tab bar.
            */}
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen
                    name="camera/index"
                    options={{ headerShown: false, presentation: 'fullScreenModal' }}
                />
            </Stack>
            <StatusBar style="auto" />
        </FieldTestProvider>
    );
}
