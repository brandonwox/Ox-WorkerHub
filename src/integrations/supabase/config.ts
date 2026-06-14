import Constants from 'expo-constants';

/**
 * Build-time Supabase config read from app.json -> expo.extra.supabase. Only the
 * publishable (anon) key ships in the client — the service role key never does
 * (admin work runs in Edge Functions). See docs/supabase-setup.md.
 *
 *   "extra": {
 *     "supabase": { "url": "https://xxxx.supabase.co", "anonKey": "eyJ..." }
 *   }
 */
interface SupabaseExtra {
  url?: string;
  anonKey?: string;
}

function supabaseExtra(): SupabaseExtra {
  const extra = (Constants.expoConfig?.extra ?? {}) as { supabase?: SupabaseExtra };
  return extra.supabase ?? {};
}

export function supabaseConfig(): { url: string; anonKey: string } {
  const { url, anonKey } = supabaseExtra();
  return { url: (url ?? '').trim(), anonKey: (anonKey ?? '').trim() };
}

/** True once both the project URL and anon key are present. */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = supabaseConfig();
  return Boolean(url && anonKey);
}
