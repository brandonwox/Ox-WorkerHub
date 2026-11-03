// work-event-email — emails the office about work events fired by DATABASE
// triggers: a work request becoming priority "Now" (set by hand, or by the
// priority escalation sweep when its priority end date arrives), and a
// delivery completing (a job count's delivered number reaching its total, or
// a Delivery-scope card's own delivered number reaching its total).
//
// Called by private.notify_work_event (over pg_net) — NOT by the app — with
// one of:
//   { event: 'work_request_now', work_request_id, by, at }
//   { event: 'delivery_complete', job_id?, work_request_id?, count_label,
//     on_site_label, delivered, total, by, at }
// Authenticated by a shared secret header (x-webhook-secret) that must equal
// the WORK_EVENT_WEBHOOK_SECRET secret — a DB-originated call carries no user
// JWT, so verify_jwt is off for this function (config.toml). Runs with the
// service role to read the card / job / people, then sends through Resend.
//
// Recipients: every Scheduler's profile email (both events) plus the job's
// Field Supers' profile emails (delivery complete), minus whoever caused the
// event. WORK_EVENT_EMAIL_TO adds fixed addresses; WORK_EVENT_EMAIL_CC copies.
//
// Secrets (supabase secrets set …):
//   RESEND_API_KEY              Resend API key (shared with the other emails)
//   EMAIL_FROM                  e.g. "Ox WorkerHub <noreply@ox-glass.com>"
//                               (falls back to AR_EMAIL_FROM if unset)
//   WORK_EVENT_WEBHOOK_SECRET   shared with private.app_settings
//   WORK_EVENT_EMAIL_TO         optional, comma-separated extra recipients
//   WORK_EVENT_EMAIL_CC         optional, comma-separated CC list
//   APP_WEB_URL                 optional, e.g. https://app.ox-glass.com — adds
//                               an "Open in Ox WorkerHub" link to each email
//
// Deploy:  supabase functions deploy work-event-email

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const TIME_ZONE = 'America/Denver';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface WebhookBody {
  event?: 'work_request_now' | 'delivery_complete';
  work_request_id?: string | null;
  job_id?: string | null;
  count_label?: string;
  on_site_label?: string;
  delivered?: number | null;
  total?: number | null;
  by?: string | null;
  at?: string | null;
}

interface TaskItem {
  id?: string;
  text?: string;
  done?: boolean;
}

interface WorkRequestRow {
  id: string;
  job_id: string | null;
  title: string;
  address: string;
  date: string;
  end_date: string | null;
  status: string;
  priority: string;
  priority_start_date: string | null;
  priority_end_date: string | null;
  scopes: string[] | null;
  tasks: (TaskItem | string)[] | null;
  readiness: string | null;
  materials: string | null;
  notes: string | null;
  delivery_count_done: number | null;
  delivery_count_total: number | null;
}

interface JobRow {
  id: string;
  name: string;
  po: string | null;
  builder: string | null;
  location: string;
  parent_job_id: string | null;
}

interface WorkerRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const splitList = (raw: string | undefined) =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const JOB_COLUMNS = 'id, name, po, builder, location, parent_job_id';

async function loadJob(
  admin: SupabaseClient,
  id: string | null | undefined
): Promise<JobRow | null> {
  if (!id) return null;
  const { data } = await admin
    .from('jobs')
    .select(JOB_COLUMNS)
    .eq('id', id)
    .maybeSingle<JobRow>();
  return data ?? null;
}

/** "Jul 15" / "Jul 15 – Jul 19" for a yyyy-MM-dd pair. */
function dateRange(start: string | null, end: string | null): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
      timeZone: TIME_ZONE,
      month: 'short',
      day: 'numeric',
    });
  if (start && end) return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  if (start || end) return fmt((start ?? end) as string);
  return '';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  // 1. Shared-secret check — the only callers are the database triggers.
  const expected = Deno.env.get('WORK_EVENT_WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!expected || !provided || provided !== expected) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? Deno.env.get('AR_EMAIL_FROM');
  const extraTo = splitList(Deno.env.get('WORK_EVENT_EMAIL_TO'));
  const cc = splitList(Deno.env.get('WORK_EVENT_EMAIL_CC'));
  const appUrl = (Deno.env.get('APP_WEB_URL') ?? '').replace(/\/+$/, '');
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
  if (body.event !== 'work_request_now' && body.event !== 'delivery_complete') {
    return json({ error: 'event must be work_request_now or delivery_complete.' }, 400);
  }

  // 2. Gather the card / job / people with the admin client.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let card: WorkRequestRow | null = null;
  if (body.work_request_id) {
    const { data } = await admin
      .from('work_requests')
      .select(
        'id, job_id, title, address, date, end_date, status, priority, priority_start_date, priority_end_date, scopes, tasks, readiness, materials, notes, delivery_count_done, delivery_count_total'
      )
      .eq('id', body.work_request_id)
      .maybeSingle<WorkRequestRow>();
    card = data ?? null;
    if (!card) return json({ error: 'Work request not found.' }, 404);
  }

  const job = await loadJob(admin, body.job_id ?? card?.job_id);
  if (body.event === 'delivery_complete' && !card && !job) {
    return json({ error: 'Job not found.' }, 404);
  }
  const parent = await loadJob(admin, job?.parent_job_id);
  const jobDisplayName = job ? (parent ? `${parent.name} · ${job.name}` : job.name) : '';
  const jobHandle = job?.po?.trim() || jobDisplayName;

  // Field Supers of the job (a sub-job's are mirrored from its parent).
  const superIds: string[] = [];
  if (job) {
    const { data: superRows } = await admin
      .from('job_field_supers')
      .select('field_super_id')
      .eq('job_id', job.id);
    for (const r of (superRows ?? []) as { field_super_id: string }[]) {
      superIds.push(r.field_super_id);
    }
  }

  const { data: workerRows } = await admin
    .from('workers')
    .select('id, name, email, role');
  const workers = (workerRows ?? []) as WorkerRow[];
  const actor = body.by ? workers.find((w) => w.id === body.by) : undefined;

  // 3. Recipients: schedulers (+ the job's Field Supers for deliveries),
  //    minus the actor, plus any fixed extra addresses — deduped.
  const recipientIds = new Set(
    workers.filter((w) => w.role === 'scheduler').map((w) => w.id)
  );
  if (body.event === 'delivery_complete') superIds.forEach((id) => recipientIds.add(id));
  if (actor) recipientIds.delete(actor.id);
  const to = new Set<string>(extraTo);
  for (const id of recipientIds) {
    const email = workers.find((w) => w.id === id)?.email?.trim();
    if (email) to.add(email);
  }
  if (to.size === 0) return json({ ok: true, skipped: 'no-recipients' });

  const at = body.at ? new Date(body.at) : new Date();
  const when = at.toLocaleString('en-US', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  // Deep link into the web console (the scheduler's work requests page opens
  // the card's sidebar; a job-only event opens the job's dashboard).
  const link = appUrl
    ? card
      ? `${appUrl}/scheduler-work-requests?openWorkRequest=${card.id}&ow=${Date.now()}`
      : job
        ? `${appUrl}/scheduler-jobs?openJob=${job.id}&oj=${Date.now()}`
        : ''
    : '';

  // 4. Compose.
  let subject: string;
  let heading: string;
  let intro: string;
  let rows: [string, string][];
  const footer = 'Sent automatically by Ox WorkerHub.';

  if (body.event === 'work_request_now') {
    const c = card as WorkRequestRow;
    const tasks = (c.tasks ?? [])
      .map((t) => (typeof t === 'string' ? t : (t.text ?? '')))
      .filter(Boolean);
    const window = dateRange(c.priority_start_date, c.priority_end_date);
    subject = `Now priority — ${jobHandle ? `${jobHandle} · ` : ''}${c.title}`;
    heading = 'Work request is now priority "Now"';
    intro = window
      ? `The priority window (${window}) on this work request has ended and it needs scheduling now.`
      : 'This work request was set to "Now" priority.';
    rows = [
      ['Work request', c.title],
      ...(job ? ([['Job', jobDisplayName]] as [string, string][]) : []),
      ['PO', job?.po ?? '—'],
      ['Builder', job?.builder ?? parent?.builder ?? '—'],
      ['Address', c.address || job?.location || '—'],
      ['Scopes', c.scopes?.length ? c.scopes.join(', ') : '—'],
      ['Priority window', window || '—'],
      ['Target date', dateRange(c.date, c.end_date) || '—'],
      ['Ready for installers', c.readiness ?? '—'],
      ['Field status', c.status],
      ['Tasks', tasks.length ? tasks.join('; ') : '—'],
      ['Materials', c.materials?.trim() || '—'],
      ['Notes', c.notes?.trim() || '—'],
      ['Set by', actor?.name ?? 'Priority window ended (automatic)'],
      ['When', when],
    ];
  } else {
    const label = body.count_label ?? 'Count';
    const onSite = body.on_site_label ?? 'Delivery complete';
    const delivered =
      body.delivered != null && body.total != null
        ? `${body.delivered}/${body.total}`
        : '—';
    subject = `Delivery complete — ${jobHandle ? `${jobHandle} · ` : ''}${onSite}`;
    heading = onSite;
    intro = card
      ? `Every piece on the delivery for "${card.title}" has arrived on site.`
      : `${label} on ${jobDisplayName || 'the job'}: every unit has been delivered to the site.`;
    rows = [
      ...(card ? ([['Work request', card.title]] as [string, string][]) : []),
      ...(job ? ([['Job', jobDisplayName]] as [string, string][]) : []),
      ['PO', job?.po ?? '—'],
      ['Builder', job?.builder ?? parent?.builder ?? '—'],
      ['Address', card?.address || job?.location || '—'],
      [label, `${delivered} delivered`],
      ['Marked by', actor?.name ?? 'Unknown'],
      ['When', when],
    ];
  }

  const text = [
    heading,
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(link ? ['', `Open in Ox WorkerHub: ${link}`] : []),
    '',
    footer,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:560px">
      <h2 style="margin:0 0 6px">${escapeHtml(heading)}</h2>
      <p style="margin:0 0 16px;color:#444">${escapeHtml(intro)}</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="color:#666;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="border-bottom:1px solid #eee"><strong>${escapeHtml(v)}</strong></td></tr>`
          )
          .join('')}
      </table>
      ${
        link
          ? `<p style="margin:16px 0 0"><a href="${escapeHtml(link)}" style="color:#1a73e8">Open in Ox WorkerHub</a></p>`
          : ''
      }
      <p style="margin:16px 0 0;color:#888;font-size:12px">${escapeHtml(footer)}</p>
    </div>`;

  // 5. Send through Resend.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [...to],
      ...(cc.length ? { cc } : {}),
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Resend rejected the email: ${res.status} ${detail}` }, 502);
  }
  const sent = await res.json().catch(() => ({}));
  return json({
    ok: true,
    id: (sent as { id?: string }).id ?? null,
    event: body.event,
    to: [...to],
    subject,
  });
});
