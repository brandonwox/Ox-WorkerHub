-- Job status for Field Supers + the "job finished" accounts-receivable email.
--
-- 1) Field Supers (and Schedulers, who share the guard) may now set a job's
--    STATUS (Active / Finished) on parents and sub-jobs alike. Previously the
--    status column was office-only (Operator). QBT jobcode, labor budget, and
--    parent_job_id stay pinned. Previous definition: 20260824180000.
--
-- 2) When any job or sub-job flips INTO 'Finished' (a real transition — a
--    re-save of an already-finished job is silent), a database trigger calls
--    the job-finished-email Edge Function over pg_net, which emails accounts
--    receivable the job's details (name, master job for a sub-job, builder,
--    PO, address, Field Supers, who finished it, when). Firing from the
--    database means an offline phone that set the status and synced later
--    still sends exactly once, when the row lands.
--
-- SETUP (one-time, after deploying the function — until both settings rows
-- exist the trigger is a silent no-op, so job saves never break):
--
--   supabase secrets set RESEND_API_KEY=re_...            (from resend.com)
--   supabase secrets set AR_EMAIL_TO=ar@ox-glass.com       (comma-separate for several)
--   supabase secrets set AR_EMAIL_CC=                      (optional, comma-separated)
--   supabase secrets set AR_EMAIL_FROM="Ox WorkerHub <noreply@ox-glass.com>"
--   supabase secrets set JOB_FINISHED_WEBHOOK_SECRET=<long random string>
--   supabase functions deploy job-finished-email
--
--   insert into private.app_settings (key, value) values
--     ('job_finished_email_url',
--      'https://<project-ref>.supabase.co/functions/v1/job-finished-email'),
--     ('job_finished_email_secret', '<the same long random string>')
--   on conflict (key) do update set value = excluded.value;
--
-- Resend needs the ox-glass.com domain verified (DNS records it shows you)
-- before it will send from an @ox-glass.com address.

-- ===========================================================================
-- 1) Field Supers + Schedulers: status joins their editable set.
-- ===========================================================================
create or replace function private.guard_job_field_super_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() in ('field_super', 'scheduler') then
    if new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id then
      raise exception 'This job field is office-only for your role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 2) Server-side settings the trigger reads (never exposed to the app — the
--    private schema isn't in the API's exposed schemas).
-- ===========================================================================
create table if not exists private.app_settings (
  key text primary key,
  value text not null
);
revoke all on private.app_settings from anon, authenticated;

-- The HTTP client the trigger uses (async; the request runs after commit).
create extension if not exists pg_net;

create or replace function private.notify_job_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  if new.status = 'Finished' and old.status is distinct from new.status then
    select value into fn_url from private.app_settings
      where key = 'job_finished_email_url';
    select value into secret from private.app_settings
      where key = 'job_finished_email_secret';
    -- Not configured yet → do nothing (the save itself must never fail).
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
        'job_id', new.id,
        -- The worker whose session made the change (null for service writes).
        'finished_by', auth.uid(),
        'finished_at', now()
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_notify_finished on public.jobs;
create trigger jobs_notify_finished
  after update of status on public.jobs
  for each row execute function private.notify_job_finished();
