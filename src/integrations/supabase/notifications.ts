import type { RealtimeChannel } from '@supabase/supabase-js';

import { AppNotification, NotificationType } from '@/types';

import { getSupabase } from './client';

/**
 * Read/write + realtime layer for {@link AppNotification}s. Maps the snake_case
 * `notifications` row onto the camelCase domain type. Inserts target another
 * worker; each recipient picks the row up through {@link subscribeNotifications}.
 */

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

function rowToNotification(r: NotificationRow): AppNotification {
  return {
    id: r.id,
    recipientId: r.recipient_id,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    data: r.data ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}

function notificationToRow(n: AppNotification) {
  return {
    id: n.id,
    recipient_id: n.recipientId,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ?? {},
    read: n.read,
    created_at: n.createdAt,
  };
}

/** The signed-in worker's notifications, newest first (capped). */
export async function fetchNotifications(
  workerId: string
): Promise<AppNotification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .eq('recipient_id', workerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as NotificationRow[]).map(rowToNotification);
}

export async function insertNotification(n: AppNotification): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .insert(notificationToRow(n));
  if (error) throw new Error(error.message);
}

/** Delete a single notification (the recipient dismissing it from the panel). */
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Delete every notification of a recipient (the panel's "Clear all"). */
export async function deleteAllNotifications(workerId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('recipient_id', workerId);
  if (error) throw new Error(error.message);
}

/**
 * Retention: drop this recipient's notifications older than `days` (default
 * 30). Fired best-effort after the login fetch — rows past the panel's
 * usefulness would otherwise pile up in the table forever.
 */
export async function deleteOldNotifications(
  workerId: string,
  days = 30
): Promise<void> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('recipient_id', workerId)
    .lt('created_at', cutoff);
  if (error) throw new Error(error.message);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(workerId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', workerId)
    .eq('read', false);
  if (error) throw new Error(error.message);
}

// One channel at a time — the signed-in worker's. Re-subscribing (or signing
// out) tears the previous one down so we never leak channels across sessions.
let channel: RealtimeChannel | null = null;

/**
 * Listen for notifications inserted for `workerId` and hand each new one to
 * `onInsert`. The server-side filter + the SELECT RLS policy both scope this to
 * the recipient, so no foreign rows ever arrive. Idempotent: replaces any prior
 * subscription.
 */
export function subscribeNotifications(
  workerId: string,
  onInsert: (n: AppNotification) => void
): void {
  unsubscribeNotifications();
  channel = getSupabase()
    .channel(`notifications:${workerId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${workerId}`,
      },
      (payload) => onInsert(rowToNotification(payload.new as NotificationRow))
    )
    .subscribe();
}

/** Tear down the active notifications channel (on sign-out / re-subscribe). */
export function unsubscribeNotifications(): void {
  if (channel) {
    getSupabase().removeChannel(channel);
    channel = null;
  }
}
