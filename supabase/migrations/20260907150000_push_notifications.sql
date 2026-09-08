-- Real phone push notifications.
--
-- The app already writes one public.notifications row per recipient for every
-- in-app ping. This adds the phone alert ON TOP of that for six types: a
-- trigger on notifications INSERT calls the push-notification Edge Function
-- over pg_net, which looks up the recipient's registered devices in
-- public.push_tokens and sends through Expo's (free) push service. Everything
-- else — the bell, the toaster, read state — is unchanged.
--
-- Pushed types (decision 2026-09-07): schedule_change, work_request_scheduled,
-- status_update_needed, work_request_now, issue_raised, job_assigned. The
-- other six stay in-app only. Quiet hours (8 PM – 6 AM Mountain) are enforced
-- in the function, not here, so they can be tuned without a migration.
--
-- SETUP (one-time; until the two settings rows exist the trigger is a silent
-- no-op — in-app notifications keep working):
--   supabase secrets set PUSH_WEBHOOK_SECRET=<long random string>
--   supabase functions deploy push-notification
--   insert into private.app_settings (key, value) values
--     ('push_function_url',
--      'https://<project-ref>.supabase.co/functions/v1/push-notification'),
--     ('push_webhook_secret', '<the same long random string>')
--   on conflict (key) do update set value = excluded.value;
-- Plus the client side: expo-notifications in the app (Pass 41), Firebase
-- Cloud Messaging credentials for Android (google-services.json + EAS
-- credentials), and a NEW native build of both apps.

-- ===========================================================================
-- Registered devices: one row per (device install), owned by its worker.
-- ===========================================================================
create table if not exists public.push_tokens (
  token       text primary key,                 -- ExponentPushToken[...]
  worker_id   uuid not null references public.workers (id) on delete cascade,
  platform    text not null default '',         -- 'ios' | 'android'
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_worker_idx on public.push_tokens (worker_id);

grant select, insert, update, delete on public.push_tokens to authenticated;
alter table public.push_tokens enable row level security;

-- A worker manages only their own devices. (The Edge Function reads every
-- row with the service role.)
drop policy if exists push_tokens_select on public.push_tokens;
create policy push_tokens_select on public.push_tokens
  for select to authenticated using (worker_id = (select auth.uid()));
drop policy if exists push_tokens_insert on public.push_tokens;
create policy push_tokens_insert on public.push_tokens
  for insert to authenticated with check (worker_id = (select auth.uid()));
drop policy if exists push_tokens_update on public.push_tokens;
create policy push_tokens_update on public.push_tokens
  for update to authenticated
  using (worker_id = (select auth.uid()))
  with check (worker_id = (select auth.uid()));
drop policy if exists push_tokens_delete on public.push_tokens;
create policy push_tokens_delete on public.push_tokens
  for delete to authenticated using (worker_id = (select auth.uid()));

-- ===========================================================================
-- Fan a new notification row out to the phone (six types only).
-- ===========================================================================
create extension if not exists pg_net;

create or replace function private.notify_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  if new.type not in (
    'schedule_change',
    'work_request_scheduled',
    'status_update_needed',
    'work_request_now',
    'issue_raised',
    'job_assigned'
  ) then
    return new;
  end if;
  select value into fn_url from private.app_settings where key = 'push_function_url';
  select value into secret from private.app_settings where key = 'push_webhook_secret';
  if fn_url is null or secret is null then
    return new;
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', secret
    ),
    body := jsonb_build_object(
      'id', new.id,
      'recipient_id', new.recipient_id,
      'type', new.type,
      'title', new.title,
      'body', new.body,
      'data', new.data,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function private.notify_push();
