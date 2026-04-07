import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

export default function RootLayout() {
    return (
        <>
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
        </>
    );
}
