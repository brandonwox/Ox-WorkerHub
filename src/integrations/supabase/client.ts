import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { supabaseConfig } from './config';

let client: SupabaseClient | null = null;

/**
 * Lazily create (and memoize) the Supabase client. Created on FIRST USE — never
 * at import time — so static web SSR, which imports this module while rendering,
 * doesn't construct it before the config is available (which throws
 * "supabaseUrl is required"). All runtime access goes through here.
 *
 * Sessions persist in AsyncStorage (localStorage on web) and auto-refresh.
 * `detectSessionInUrl` is on for web only — a magic-link / invite lands back in
 * the browser URL there; on native it arrives via the oxworkerhub:// deep link.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured — set expo.extra.supabase.{url,anonKey} in ' +
        'app.json and restart the dev server.'
    );
  }

  client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  // Keep the session fresh while the native app is foregrounded.
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }

  return client;
}
