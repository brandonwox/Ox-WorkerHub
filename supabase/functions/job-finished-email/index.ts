// job-finished-email — emails accounts receivable when a job or sub-job is
// set to Finished.
//
// Called by the database trigger private.notify_job_finished (over pg_net)
// with { job_id, finished_by, finished_at }; NOT by the app. Authenticated by
// a shared secret header (x-webhook-secret) that must equal the
// JOB_FINISHED_WEBHOOK_SECRET secret — there's no user JWT on a DB-originated
// call, so verify_jwt is off for this function (config.toml). Runs with the
// service role (auto-provided on Supabase-hosted runs; never in the app) to
// read the job, its parent, its Field Supers, and the finisher's name, then
// sends through Resend.
//
// Secrets (supabase secrets set …):
//   RESEND_API_KEY               Resend API key (resend.com; domain verified)
//   AR_EMAIL_TO                  recipient(s), comma-separated
//   AR_EMAIL_CC                  optional CC list, comma-separated
//   AR_EMAIL_FROM                e.g. "Ox WorkerHub <noreply@ox-glass.com>"
//   JOB_FINISHED_WEBHOOK_SECRET  shared with private.app_settings
//
// Deploy:  supabase functions deploy job-finished-email

import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface WebhookBody {
  job_id?: string;
  finished_by?: string | null;
  finished_at?: string | null;
}

interface JobRow {
  id: string;
  name: string;
  po: string | null;
  builder: string | null;
  location: string;
  status: string;
  parent_job_id: string | null;
  sub_job_type: string | null;
  qbt_jobcode_id: string | null;
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  // 1. Shared-secret check — the only caller is the database trigger.
  const expected = Deno.env.get('JOB_FINISHED_WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!expected || !provided || provided !== expected) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = splitList(Deno.env.get('AR_EMAIL_TO'));
  const cc = splitList(Deno.env.get('AR_EMAIL_CC'));
  const from = Deno.env.get('AR_EMAIL_FROM');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Function is missing Supabase environment.' }, 500);
  }
  if (!resendKey || to.length === 0 || !from) {
    return json(
      {
        error:
          'Email is not configured: set RESEND_API_KEY, AR_EMAIL_TO, and AR_EMAIL_FROM.',
      },
      500
    );
  }

  const body = (await req.json().catch(() => ({}))) as WebhookBody;
  if (!body.job_id) return json({ error: 'job_id is required.' }, 400);

  // 2. Gather the job's details with the admin client.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select(
      'id, name, po, builder, location, status, parent_job_id, sub_job_type, qbt_jobcode_id'
    )
    .eq('id', body.job_id)
    .single<JobRow>();
  if (jobErr || !job) {
    return json({ error: jobErr?.message ?? 'Job not found.' }, 404);
  }

  let parent: JobRow | null = null;
  if (job.parent_job_id) {
    const { data } = await admin
      .from('jobs')
      .select(
        'id, name, po, builder, location, status, parent_job_id, sub_job_type, qbt_jobcode_id'
      )
      .eq('id', job.parent_job_id)
      .maybeSingle<JobRow>();
    parent = data ?? null;
  }

  // Field Supers: the job's own rows (a sub-job's are mirrored from its parent).
  const { data: superRows } = await admin
    .from('job_field_supers')
    .select('field_super_id')
    .eq('job_id', job.id);
  const superIds = (superRows ?? []).map(
    (r: { field_super_id: string }) => r.field_super_id
  );
  const nameIds = [...superIds];
  if (body.finished_by) nameIds.push(body.finished_by);
  const { data: workerRows } = nameIds.length
    ? await admin
        .from('workers')
        .select('id, name, email, phone')
        .in('id', nameIds)
    : { data: [] as { id: string; name: string; email: string; phone: string }[] };
  const workers = (workerRows ?? []) as {
    id: string;
    name: string;
    email: string;
    phone: string;
  }[];
  const nameOf = (id: string) => workers.find((w) => w.id === id)?.name;
  const superNames = superIds
    .map((id) => nameOf(id))
    .filter((n): n is string => !!n);
  const finisher = body.finished_by ? nameOf(body.finished_by) : undefined;

  // 3. Compose. A sub-job reads "Master Job · Lot 159" — the master job's
  //    name plus the sub-job's own name (which already carries its type).
  const displayName = parent ? `${parent.name} · ${job.name}` : job.name;
  const builder = job.builder ?? parent?.builder ?? '';
  const finishedAt = body.finished_at ? new Date(body.finished_at) : new Date();
  const when = finishedAt.toLocaleString('en-US', {
    timeZone: 'America/Denver',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const rows: [string, string][] = [
    ['Job', displayName],
    ...(parent
      ? ([
          ['Master job', parent.name],
          [
            parent.sub_job_type
              ? parent.sub_job_type.replace(/s$/i, '')
              : 'Sub-job',
            job.name,
          ],
        ] as [string, string][])
      : []),
    ['PO', job.po ?? '—'],
    ['Builder', builder || '—'],
    ['Jobsite address', job.location || '—'],
    ['Field Super(s)', superNames.length ? superNames.join(', ') : 'None assigned'],
    ['QBT jobcode', job.qbt_jobcode_id ?? '—'],
    ['Marked finished by', finisher ?? 'Unknown'],
    ['Finished at', when],
  ];

  const subject = `Job finished — ${displayName}${job.po ? ` (PO ${job.po})` : ''}`;
  const text = [
    `${displayName} has been marked Finished and is ready for billing.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Sent automatically by Ox WorkerHub.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;max-width:560px">
      <h2 style="margin:0 0 6px">Job finished — ready for billing</h2>
      <p style="margin:0 0 16px;color:#444">${escapeHtml(displayName)} was marked <strong>Finished</strong>.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="color:#666;border-bottom:1px solid #eee;white-space:nowrap">${escapeHtml(k)}</td><td style="border-bottom:1px solid #eee"><strong>${escapeHtml(v)}</strong></td></tr>`
          )
          .join('')}
      </table>
      <p style="margin:16px 0 0;color:#888;font-size:12px">Sent automatically by Ox WorkerHub.</p>
    </div>`;

  // 4. Send through Resend.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
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
  return json({ ok: true, id: (sent as { id?: string }).id ?? null, subject });
});
