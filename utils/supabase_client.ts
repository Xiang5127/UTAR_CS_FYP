import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// console.log('SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
// console.log('SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

// useEffect(() => {
//
// }, []);
// We don't do useEffect() to check for availability of API keys
// because useEffect() runs after components are loaded

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
