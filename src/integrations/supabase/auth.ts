import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { AppRole, Worker, WorkerStatus } from '@/types';

import { getSupabase } from './client';

/**
 * Session + identity helpers for the Supabase auth flow. These are the building
 * blocks the next stage wires into the store (session -> active worker + role),
 * replacing the dev "View as" switcher. Kept as a thin library so the data swap
 * can adopt them without UI churn.
 */

export async function signIn(email: string, password: string) {
  return getSupabase().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return getSupabase().auth.signOut();
}

/**
 * Sign in with Google via Supabase OAuth.
 *
 * Web: full-page redirect to Google; Supabase lands back on the site with the
 * session in the URL, which the client consumes (detectSessionInUrl) and the
 * auth listener picks up like any other sign-in.
 *
 * Native: open Google in an auth-session browser, catch the oxworkerhub://
 * deep-link callback, and install the returned tokens as the session.
 *
 * Resolves `{ error: null }` when the user simply cancels the browser flow.
 */
export async function signInWithGoogle(): Promise<{
  error: { message: string } | null;
}> {
  const supabase = getSupabase();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  }

  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { error: error ?? { message: 'Could not start Google sign-in.' } };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { error: null };

  // Tokens come back in the callback URL fragment (implicit flow).
  const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    return { error: { message: 'Google sign-in did not return a session.' } };
  }
  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  return { error: sessionError };
}

/**
 * Set (or change) the signed-in user's password. Invited workers arrive with a
 * session (from the email invite link) but no password; this is how they set one
 * so they can sign in normally afterwards. Requires an active session.
 */
export async function updatePassword(password: string) {
  return getSupabase().auth.updateUser({ password });
}

/** Current session (or null), read from persisted storage. */
export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

/**
 * Push the current session's JWT to the Realtime socket.
 *
 * supabase-js sets this automatically on SIGNED_IN and TOKEN_REFRESHED, but NOT
 * on INITIAL_SESSION — the event fired when a session is restored from storage
 * on a cold load (a page refresh, or reopening the app). Without the JWT the
 * Realtime connection authenticates as `anon`, so every RLS-protected
 * `postgres_changes` subscription silently receives nothing (notifications never
 * ping, backlogs never update live). Call this right before opening channels so
 * live updates work for a restored session, not just a fresh sign-in.
 */
export async function syncRealtimeAuth(): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(data.session?.access_token ?? null);
}

/** Subscribe to auth changes; returns an unsubscribe function. */
export function onAuthChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

/** Shape of a row in public.workers (snake_case columns). */
interface WorkerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  trade_role: string;
  installer_type: string;
  hourly_rate: number;
  status: WorkerStatus;
}

/** Map a DB workers row onto the app's camelCase Worker type. */
export function rowToWorker(row: WorkerRow): Worker {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    tradeRole: row.trade_role,
    installerType: (row.installer_type || undefined) as Worker['installerType'],
    hourlyRate: Number(row.hourly_rate),
    status: row.status,
  };
}

/**
 * The signed-in user's worker record (drives the active role), or null if not
 * signed in or no matching workers row exists yet.
 */
export async function fetchCurrentWorker(): Promise<Worker | null> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('id', auth.user.id)
    .single();
  if (error || !data) return null;
  return rowToWorker(data as WorkerRow);
}
