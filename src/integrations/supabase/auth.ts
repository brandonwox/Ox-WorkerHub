import { Session } from '@supabase/supabase-js';

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

/** Current session (or null), read from persisted storage. */
export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

/** Subscribe to auth changes; returns an unsubscribe function. */
export function onAuthChange(
  callback: (session: Session | null) => void
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    callback(session);
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
