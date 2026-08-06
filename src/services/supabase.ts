import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ── Configuración de Supabase ────────────────────────────────────────────────
//
// Ambos valores están hardcodeados a propósito, no es un descuido.
//
// La publishable key está diseñada para viajar en el cliente: no otorga ningún
// acceso por sí sola, lo que protege los datos es Row Level Security. Es el
// equivalente de la anon key legacy, pero no es un JWT, así que tampoco
// dispara los escáneres de secretos de GitHub.
//
// Tenerlos acá elimina toda la clase de bugs de BUG-005: ya no dependen de
// variables de entorno que pueden llegar undefined en un build de EAS.
//
// Lo que NUNCA va acá: la secret key (sb_secret_...), que sí bypassea RLS.
// Esa vive solo en las variables de entorno de las Edge Functions.

export const SUPABASE_URL = 'https://mippjtmsrvjxyccmvpzl.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ea-vKqJxVY9wslUBzuQMvg_v4HIexeY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
