// push-notification — sends one in-app notification to the recipient's phones.
//
// Called by the database trigger private.notify_push (over pg_net) for the six
// pushed notification types, with the notifications row as the body; NOT by
// the app. Authenticated by the x-webhook-secret header (must equal the
// PUSH_WEBHOOK_SECRET secret) — a DB-originated call carries no user JWT, so
// verify_jwt is off for this function (config.toml). Runs with the service
// role to read public.push_tokens, then posts to Expo's push API (free; the
// only limit is 600 messages/second per project).
//
// Quiet hours: nothing is pushed between 8 PM and 6 AM Mountain time — the
// in-app notification still lands and the bell still shows it.
//
// Secrets (supabase secrets set …):
//   PUSH_WEBHOOK_SECRET   shared with private.app_settings.push_webhook_secret
//   EXPO_ACCESS_TOKEN     optional — an Expo access token, if you turn on
//                         "Enhanced Security for Push Notifications" for the
//                         Expo project (expo.dev → project → Credentials)
//
// Deploy:  supabase functions deploy push-notification

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const QUIET_START_HOUR = 20; // 8 PM
const QUIET_END_HOUR = 6; // 6 AM
const TIME_ZONE = 'America/Denver';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface NotificationRow {
  id?: string;
  recipient_id?: string;
  type?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
  created_at?: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** The hour (0–23) right now in Mountain time. */
function mountainHour(): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  return Number(h) % 24;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // 1. Shared-secret check — the only caller is the database trigger.
  const expected = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!expected || !provided || provided !== expected) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Function is missing Supabase environment.' }, 500);
  }

  const row = (await req.json().catch(() => ({}))) as NotificationRow;
  if (!row.recipient_id || !row.title) {
    return json({ error: 'recipient_id and title are required.' }, 400);
  }

  // 2. Quiet hours — skip the phone, keep the in-app row.
  const hour = mountainHour();
  if (hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR) {
    return json({ ok: true, skipped: 'quiet-hours', hour });
  }

  // 3. The recipient's devices.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: tokenRows, error: tokenErr } = await admin
    .from('push_tokens')
    .select('token')
    .eq('worker_id', row.recipient_id);
  if (tokenErr) return json({ error: tokenErr.message }, 500);
  const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
  if (tokens.length === 0) return json({ ok: true, skipped: 'no-devices' });

  // 4. Send through Expo. `data` carries what the app's notification router
  //    needs to open the right screen on tap (same shape as the in-app row).
  const messages = tokens.map((to) => ({
    to,
    title: row.title,
    body: row.body ?? '',
    sound: 'default',
    channelId: 'default',
    priority: 'high',
    data: {
      notificationId: row.id ?? null,
      type: row.type ?? null,
      ...(row.data ?? {}),
    },
  }));

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Expo push rejected: ${res.status} ${detail}` }, 502);
  }
  const result = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[] };
  const tickets = result.data ?? [];

  // 5. Prune devices Expo says are gone (uninstalled / permission revoked).
  const dead: string[] = [];
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      dead.push(tokens[i]);
    }
  });
  if (dead.length > 0) {
    await admin.from('push_tokens').delete().in('token', dead);
  }

  return json({
    ok: true,
    sent: tickets.filter((t) => t.status === 'ok').length,
    failed: tickets.filter((t) => t.status === 'error').length,
    pruned: dead.length,
  });
});
