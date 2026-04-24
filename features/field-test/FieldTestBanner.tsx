import React from 'react';
import { Text, View } from 'react-native';

export const FieldTestBanner: React.FC = () => (
    <View className="bg-yellow-400 px-3 py-1">
        <Text className="text-black text-xs font-bold text-center">FIELD TEST MODE</Text>
    </View>
);
