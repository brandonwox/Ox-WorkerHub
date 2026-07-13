// invite-worker — Operator-only worker invitation.
//
// Sends an email invite (creates the auth.users row) and inserts the matching
// public.workers row with status 'invited'. Runs with the service role, which is
// auto-provided on Supabase-hosted runs and NEVER ships in the app. The caller's
// JWT is verified by the platform (verify_jwt), and we additionally confirm the
// caller is an Operator before doing anything.
//
// Deploy:  supabase functions deploy invite-worker
//
// Uses the stable Deno.serve + explicit createClient pattern.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ROLES = [
  'installer',
  'scheduler',
  'operator',
  'field_super',
  'finance_manager',
  'developer',
] as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface InviteBody {
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
  tradeRole?: string;
  hourlyRate?: number;
  redirectTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Function is missing Supabase environment.' }, 500);
  }

  // 1. Identify the caller from their JWT.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerAuth, error: callerErr } = await caller.auth.getUser();
  if (callerErr || !callerAuth.user) {
    return json({ error: 'Not authenticated.' }, 401);
  }

  // 2. Admin client (bypasses RLS) for the role check + invite + insert.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerWorker } = await admin
    .from('workers')
    .select('role')
    .eq('id', callerAuth.user.id)
    .single();
  if (callerWorker?.role !== 'operator') {
    return json({ error: 'Only operators can invite workers.' }, 403);
  }

  // 3. Validate input.
  const body = (await req.json().catch(() => ({}))) as InviteBody;
  const email = body.email?.trim();
  const name = body.name?.trim();
  if (!email || !name) {
    return json({ error: 'email and name are required.' }, 400);
  }
  const role =
    body.role && (ALLOWED_ROLES as readonly string[]).includes(body.role)
      ? body.role
      : 'installer';

  // 4. Send the email invite (creates the auth.users row).
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(
      email,
      body.redirectTo ? { redirectTo: body.redirectTo } : undefined
    );
  if (inviteErr || !invited.user) {
    return json({ error: inviteErr?.message ?? 'Invite failed.' }, 400);
  }

  // 5. Insert the matching workers row.
  const { data: worker, error: insertErr } = await admin
    .from('workers')
    .insert({
      id: invited.user.id,
      name,
      email,
      phone: body.phone ?? '',
      role,
      trade_role: body.tradeRole ?? '',
      hourly_rate: body.hourlyRate ?? 0,
      status: 'invited',
    })
    .select()
    .single();
  if (insertErr) {
    // Roll back the auth user so a failed insert doesn't strand an orphan.
    await admin.auth.admin.deleteUser(invited.user.id);
    return json({ error: insertErr.message }, 400);
  }

  return json({ worker }, 200);
});
