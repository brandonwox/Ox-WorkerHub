import { AuthChangeEvent, Session } from '@supabase/supabase-js';

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
