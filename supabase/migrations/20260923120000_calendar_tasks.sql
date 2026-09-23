-- Field Super calendar tasks + timed reminders.
--
-- A calendar task is a Field Super's OWN note on a calendar day: a title,
-- optional description, an optional checklist (the same jsonb shape as
-- work_requests.tasks), and an optional reminder time. It is not a work
-- request — nothing is scheduled onto a crew and no other role sees it. The
-- hover-＋ on a day of the Field Super's calendar (web) and the "Add task"
-- button on the phone calendar create one.
--
-- Reminders: a pg_cron job runs private.send_due_task_reminders() every
-- minute. Each due, unsent reminder is stamped sent and (1) inserts a
-- public.notifications row of type 'task_reminder' for the owner — the
-- existing notifications → push trigger (20260907150000) fans that out to
-- their phone — and (2) calls the task-reminder-email Edge Function over
-- pg_net, which emails the owner through Resend. Stamping BEFORE sending
-- means a reminder can never fire twice, even if a send fails.
--
-- SETUP (one-time; until the two settings rows exist the email leg is a
-- silent no-op — the in-app row and the phone push still go out):
--   supabase secrets set RESEND_API_KEY=re_...            (shared with the AR email)
--   supabase secrets set EMAIL_FROM="Ox WorkerHub <noreply@ox-glass.com>"
--   supabase secrets set TASK_REMINDER_WEBHOOK_SECRET=<long random string>
--   supabase functions deploy task-reminder-email
--   insert into private.app_settings (key, value) values
--     ('task_reminder_email_url',
--      'https://<project-ref>.supabase.co/functions/v1/task-reminder-email'),
--     ('task_reminder_email_secret', '<the same long random string>')
--   on conflict (key) do update set value = excluded.value;
-- pg_cron must be enabled on the project (Dashboard → Database → Extensions →
-- pg_cron); the `create extension` below does that when the role may.

-- ===========================================================================
-- Table
-- ===========================================================================
create table if not exists public.calendar_tasks (
  id               uuid primary key default gen_random_uuid(),
  worker_id        uuid not null references public.workers (id) on delete cascade,
  title            text not null,
  description      text not null default '',
  -- The calendar day the task sits on (yyyy-MM-dd).
  date             date not null,
  -- Checklist: [{ "id": uuid, "text": ..., "done": bool, "doneById"?: uuid,
  -- "doneAt"?: iso }] — identical to work_requests.tasks.
  tasks            jsonb not null default '[]'::jsonb,
  -- When to remind the owner (null = no reminder). Chosen as a time of day
  -- on the task's date; stored as an absolute instant.
  reminder_at      timestamptz,
  -- Stamped by the sweep the moment the reminder goes out.
  reminder_sent_at timestamptz,
  done             boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists calendar_tasks_worker_date_idx
  on public.calendar_tasks (worker_id, date);
-- The sweep's access path: due, unsent reminders.
create index if not exists calendar_tasks_reminder_due_idx
  on public.calendar_tasks (reminder_at)
  where reminder_at is not null and reminder_sent_at is null;

-- ===========================================================================
-- Grants + RLS — a task is private to its owner.
-- ===========================================================================
grant select, insert, update, delete on public.calendar_tasks to authenticated;

alter table public.calendar_tasks enable row level security;

drop policy if exists calendar_tasks_select on public.calendar_tasks;
create policy calendar_tasks_select on public.calendar_tasks
  for select to authenticated
  using (worker_id = (select auth.uid()));

drop policy if exists calendar_tasks_insert on public.calendar_tasks;
create policy calendar_tasks_insert on public.calendar_tasks
  for insert to authenticated
  with check (worker_id = (select auth.uid()));

drop policy if exists calendar_tasks_update on public.calendar_tasks;
create policy calendar_tasks_update on public.calendar_tasks
  for update to authenticated
  using (worker_id = (select auth.uid()))
  with check (worker_id = (select auth.uid()));

drop policy if exists calendar_tasks_delete on public.calendar_tasks;
create policy calendar_tasks_delete on public.calendar_tasks
  for delete to authenticated
  using (worker_id = (select auth.uid()));

-- Editing a reminder re-arms it: a changed reminder time clears the sent
-- stamp so the new time fires (the app never writes reminder_sent_at).
create or replace function private.rearm_calendar_task_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reminder_at is distinct from old.reminder_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_tasks_rearm_reminder on public.calendar_tasks;
create trigger calendar_tasks_rearm_reminder
  before update of reminder_at on public.calendar_tasks
  for each row execute function private.rearm_calendar_task_reminder();

-- ===========================================================================
-- Realtime — a task created on the phone shows on the web calendar (and the
-- sweep's done/sent stamps stream back).
-- ===========================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calendar_tasks'
  ) then
    alter publication supabase_realtime add table public.calendar_tasks;
  end if;
end $$;

-- ===========================================================================
-- Phone push: 'task_reminder' joins the pushed notification types.
-- Previous definition: 20260907150000_push_notifications.sql. The push
-- function itself skips quiet hours for this type — the owner chose the time.
-- ===========================================================================
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
    'job_assigned',
    'task_reminder'
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

-- ===========================================================================
-- The reminder sweep (called by pg_cron every minute).
-- ===========================================================================
create extension if not exists pg_net;

create or replace function private.send_due_task_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
  due record;
  fired integer := 0;
  when_text text;
begin
  select value into fn_url from private.app_settings
    where key = 'task_reminder_email_url';
  select value into secret from private.app_settings
    where key = 'task_reminder_email_secret';

  -- Claim every due reminder in one statement (stamped before anything is
  -- sent, so a concurrent or repeated sweep can't double-fire).
  for due in
    update public.calendar_tasks
      set reminder_sent_at = now()
      where reminder_at is not null
        and reminder_at <= now()
        and reminder_sent_at is null
      returning id, worker_id, title, description, date, reminder_at
  loop
    fired := fired + 1;
    -- "7:30 AM" in Mountain time for the notification body.
    when_text := trim(both ' ' from to_char(
      due.reminder_at at time zone 'America/Denver', 'FMHH12:MI AM'
    ));

    -- 1) In-app notification (+ phone push via the notifications trigger).
    insert into public.notifications (recipient_id, type, title, body, data)
    values (
      due.worker_id,
      'task_reminder',
      due.title,
      case
        when nullif(trim(due.description), '') is null
          then 'Reminder · ' || when_text
        else 'Reminder · ' || when_text || ' — ' || due.description
      end,
      jsonb_build_object(
        'calendarTaskId', due.id,
        'date', to_char(due.date, 'YYYY-MM-DD')
      )
    );

    -- 2) Email, when configured.
    if fn_url is not null and secret is not null then
      perform net.http_post(
        url := fn_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', secret
        ),
        body := jsonb_build_object('task_id', due.id)
      );
    end if;
  end loop;

  return fired;
end;
$$;

revoke all on function private.send_due_task_reminders() from public;

-- ===========================================================================
-- Schedule the sweep: every minute. Re-running this migration replaces the
-- job (same name) instead of stacking a second one.
-- ===========================================================================
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'calendar-task-reminders') then
    perform cron.unschedule('calendar-task-reminders');
  end if;
  perform cron.schedule(
    'calendar-task-reminders',
    '* * * * *',
    $job$ select private.send_due_task_reminders(); $job$
  );
end $$;
