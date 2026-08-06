import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Doble fallback: app.config.js ya inyecta la key vía extra; el fallback
// directo aquí garantiza que el cliente siempre se inicialice en producción.
const FALLBACK_URL     = 'https://mippjtmsrvjxyccmvpzl.supabase.co';
const FALLBACK_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcHBqdG1zcnZqeHljY212cHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTc1MDcsImV4cCI6MjA5Mzc3MzUwN30.kgvaK7NlhlRgAkpfNFsrd4yohR1rYgRHT8o5wQCeEtA';

const supabaseUrl     = (Constants.expoConfig?.extra?.supabaseUrl     as string | undefined) ?? FALLBACK_URL;
const supabaseAnonKey = (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ?? FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
