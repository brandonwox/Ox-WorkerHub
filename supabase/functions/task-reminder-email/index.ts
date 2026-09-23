// task-reminder-email — emails a Field Super their calendar task reminder.
//
// Called by private.send_due_task_reminders() (the pg_cron sweep, over
// pg_net) with { task_id }; NOT by the app. Authenticated by a shared secret
// header (x-webhook-secret) that must equal the TASK_REMINDER_WEBHOOK_SECRET
// secret — a DB-originated call carries no user JWT, so verify_jwt is off for
// this function (config.toml). Runs with the service role to read the task
// and its owner's email, then sends through Resend. The in-app notification
// and the phone push are handled by the sweep itself, not here.
//
// Secrets (supabase secrets set …):
//   RESEND_API_KEY                 Resend API key (resend.com; domain verified)
//   EMAIL_FROM                     e.g. "Ox WorkerHub <noreply@ox-glass.com>"
//                                  (falls back to AR_EMAIL_FROM if unset)
//   TASK_REMINDER_WEBHOOK_SECRET   shared with private.app_settings
//
// Deploy:  supabase functions deploy task-reminder-email

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TIME_ZONE = 'America/Denver';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface WebhookBody {
  task_id?: string;
}

interface ChecklistItem {
  id?: string;
  text?: string;
  done?: boolean;
}

interface TaskRow {
  id: string;
  worker_id: string;
  title: string;
  description: string;
  date: string;
  tasks: ChecklistItem[] | null;
  reminder_at: string | null;
  done: boolean;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  // 1. Shared-secret check — the only caller is the database sweep.
  const expected = Deno.env.get('TASK_REMINDER_WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!expected || !provided || provided !== expected) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? Deno.env.get('AR_EMAIL_FROM');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Function is missing Supabase environment.' }, 500);
  }
  if (!resendKey || !from) {
    return json(
      { error: 'Email is not configured: set RESEND_API_KEY and EMAIL_FROM.' },
      500
    );
  }

  const body = (await req.json().catch(() => ({}))) as WebhookBody;
  if (!body.task_id) return json({ error: 'task_id is required.' }, 400);

  // 2. The task and its owner.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: task, error: taskErr } = await admin
    .from('calendar_tasks')
    .select('id, worker_id, title, description, date, tasks, reminder_at, done')
    .eq('id', body.task_id)
    .single<TaskRow>();
  if (taskErr || !task) {
    return json({ error: taskErr?.message ?? 'Task not found.' }, 404);
  }

  const { data: owner } = await admin
    .from('workers')
    .select('id, name, email')
    .eq('id', task.worker_id)
    .maybeSingle<{ id: string; name: string; email: string | null }>();
  const to = owner?.email?.trim();
  if (!to) return json({ ok: true, skipped: 'no-email' });

  // 3. Compose.
  const when = task.reminder_at
    ? new Date(task.reminder_at).toLocaleString('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : new Date(`${task.date}T12:00:00`).toLocaleDateString('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
  const description = task.description?.trim() ?? '';
  const items = (task.tasks ?? []).filter((t) => (t.text ?? '').trim());

  const subject = `Reminder: ${task.title}`;
  const text = [
    `${task.title}`,
    when,
    ...(description ? ['', description] : []),
    ...(items.length
      ? ['', 'Tasks:', ...items.map((t) => `${t.done ? '[x]' : '[ ]'} ${t.text}`)]
      : []),
    '',
    'Sent automatically by Ox WorkerHub — this is a reminder you set on your calendar.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:560px">
      <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Task reminder</p>
      <h2 style="margin:0 0 6px">${escapeHtml(task.title)}</h2>
      <p style="margin:0 0 16px;color:#444">${escapeHtml(when)}</p>
      ${
        description
          ? `<p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(description)}</p>`
          : ''
      }
      ${
        items.length
          ? `<p style="margin:0 0 6px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Tasks</p>
             <ul style="margin:0 0 16px;padding-left:20px">
               ${items
                 .map(
                   (t) =>
                     `<li style="margin:2px 0;${t.done ? 'color:#888;text-decoration:line-through' : ''}">${escapeHtml(t.text ?? '')}</li>`
                 )
                 .join('')}
             </ul>`
          : ''
      }
      <p style="margin:16px 0 0;color:#888;font-size:12px">Sent automatically by Ox WorkerHub — this is a reminder you set on your calendar.</p>
    </div>`;

  // 4. Send through Resend.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Resend rejected the email: ${res.status} ${detail}` }, 502);
  }
  const sent = await res.json().catch(() => ({}));
  return json({ ok: true, id: (sent as { id?: string }).id ?? null, to, subject });
});
