import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { supabaseConfig } from './config';

const { url, anonKey } = supabaseConfig();

/**
 * The shared Supabase client. Sessions persist in AsyncStorage (which maps to
 * localStorage on web) and auto-refresh while the app is in use.
 *
 * `detectSessionInUrl` is on for web only — there a magic-link / invite lands
 * back in the browser URL; on native the session arrives via the oxworkerhub://
 * deep link handled by the auth flow.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Keep the session fresh while the native app is foregrounded. (On web the
// browser tab lifecycle handles this; AppState 'active' is a native concept.)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
