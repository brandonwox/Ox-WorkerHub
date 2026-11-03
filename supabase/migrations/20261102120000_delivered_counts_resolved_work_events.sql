-- Delivered counts, resolved work requests, and server-side work events
-- (the priority-"Now" and delivery-complete emails + the priority escalation
-- sweep).
--
-- 1) jobs.<count>_delivered — one DELIVERED (on-site) number per scope count,
--    next to the existing done (installed) / total pair: window, sgd, mirror,
--    shower, swing_door, screen, igu. Installers and office roles update it
--    from the count popups (installer guard: writable by omission, like the
--    done numbers; finance guard: pinned like every other count column).
--    When delivered reaches the total the app reads "All Windows are On
--    Site" (etc.) and pings the office; the trigger below sends the email.
--
-- 2) work_requests.resolved_at / resolved_by — the Scheduler's close-out.
--    Resolved cards leave the Work Requests pool and the work requests
--    pages' default list. Office-only (installer guard).
--
-- 3) WORK EVENTS → the work-event-email Edge Function (over pg_net):
--      * 'work_request_now'  — a card's priority becomes 'Now' (on insert,
--        or an update transition), whether set by hand or by the sweep.
--      * 'delivery_complete' — a job count's delivered number reaches its
--        total, or a Delivery-scope card's own delivered number reaches its
--        total (a drop of the total down to the delivered number counts too).
--    Same shape as the job-finished email: the trigger reads two
--    private.app_settings rows and is a silent no-op until they exist, so
--    saves never break.
--
-- 4) PRIORITY ESCALATION SWEEP (pg_cron, every 15 minutes): a card whose
--    priority END date has arrived (Mountain time), isn't Finished, and
--    isn't resolved becomes 'Now' server-side — so the "Now" email and the
--    schedulers' in-app ping go out even when nobody has the app open. The
--    app's own hourly sweep stays as a fallback (and for dev mode); whichever
--    runs first wins and the other finds nothing left to escalate.
--
-- SETUP (one-time, after deploying the function — until both settings rows
-- exist every work event is a silent no-op):
--
--   supabase secrets set WORK_EVENT_WEBHOOK_SECRET=<long random string>
--   (RESEND_API_KEY and EMAIL_FROM are shared with the other emails. Optional:
--    WORK_EVENT_EMAIL_TO / WORK_EVENT_EMAIL_CC for fixed extra addresses, and
--    APP_WEB_URL — e.g. https://app.ox-glass.com — for an "Open in Ox
--    WorkerHub" link in each email.)
--   supabase functions deploy work-event-email
--
--   insert into private.app_settings (key, value) values
--     ('work_event_email_url',
--      'https://<project-ref>.supabase.co/functions/v1/work-event-email'),
--     ('work_event_email_secret', '<the same long random string>')
--   on conflict (key) do update set value = excluded.value;
--
-- Recipients come from worker profiles: every Scheduler's email for both
-- events, plus the job's Field Supers' emails for delivery-complete (minus
-- whoever caused the event). pg_cron must be enabled (it already is if the
-- calendar task reminders migration ran).

-- ===========================================================================
-- 1) Delivered numbers on jobs.
-- ===========================================================================
alter table public.jobs
  add column if not exists window_count_delivered integer,
  add column if not exists sgd_count_delivered integer,
  add column if not exists mirror_count_delivered integer,
  add column if not exists shower_count_delivered integer,
  add column if not exists swing_door_count_delivered integer,
  add column if not exists screen_count_delivered integer,
  add column if not exists igu_count_delivered integer;

-- Finance managers: still QBT jobcode + labor budget + flashing only — pin
-- the delivered columns too. (Latest previous definition:
-- 20260813120000_job_archive.sql.) The installer guard
-- (guard_job_cover_only_update, 20260824180000) is a blocklist, so the new
-- columns are installer-writable by omission — exactly like the done numbers.
create or replace function private.guard_job_finance_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'finance_manager' then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.po is distinct from old.po
       or new.builder is distinct from old.builder
       or new.scopes is distinct from old.scopes
       or new.cover_photo_id is distinct from old.cover_photo_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
       or new.sub_job_type is distinct from old.sub_job_type
       or new.archived_at is distinct from old.archived_at
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_done is distinct from old.window_count_done
       or new.window_count_total is distinct from old.window_count_total
       or new.window_count_delivered is distinct from old.window_count_delivered
       or new.sgd_count_done is distinct from old.sgd_count_done
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.sgd_count_delivered is distinct from old.sgd_count_delivered
       or new.mirror_count_done is distinct from old.mirror_count_done
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.mirror_count_delivered is distinct from old.mirror_count_delivered
       or new.shower_count_done is distinct from old.shower_count_done
       or new.shower_count_total is distinct from old.shower_count_total
       or new.shower_count_delivered is distinct from old.shower_count_delivered
       or new.swing_door_count_done is distinct from old.swing_door_count_done
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.swing_door_count_delivered is distinct from old.swing_door_count_delivered
       or new.screen_count_done is distinct from old.screen_count_done
       or new.screen_count_total is distinct from old.screen_count_total
       or new.screen_count_delivered is distinct from old.screen_count_delivered
       or new.igu_count_done is distinct from old.igu_count_done
       or new.igu_count_total is distinct from old.igu_count_total
       or new.igu_count_delivered is distinct from old.igu_count_delivered
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
       or new.shower_layout_not_needed is distinct from old.shower_layout_not_needed then
      raise exception 'Finance managers may only edit the QBT jobcode, labor budget, and flashing material on a job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 2) Resolved work requests.
-- ===========================================================================
alter table public.work_requests
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.workers (id) on delete set null;

-- Installer guard: the resolve stamp is office-only. (Latest previous
-- definition: 20261021120000_calendars_planned_crews_end_date.sql.)
create or replace function private.guard_work_request_installer_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'installer' then
    if new.title is distinct from old.title
       or new.job_id is distinct from old.job_id
       or new.address is distinct from old.address
       or new.date is distinct from old.date
       or new.end_date is distinct from old.end_date
       or new.planned_crew_ids is distinct from old.planned_crew_ids
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.priority is distinct from old.priority
       or new.priority_order is distinct from old.priority_order
       or new.scopes is distinct from old.scopes
       or private.work_request_tasks_content(new.tasks)
          is distinct from private.work_request_tasks_content(old.tasks)
       or new.readiness is distinct from old.readiness
       or new.flashing_material is distinct from old.flashing_material
       or new.materials is distinct from old.materials
       or new.scope_of_work is distinct from old.scope_of_work
       or new.pickup_required is distinct from old.pickup_required
       or new.pickup_location is distinct from old.pickup_location
       or new.delivery_count_total is distinct from old.delivery_count_total
       or new.windows_casements is distinct from old.windows_casements
       or new.resolved_at is distinct from old.resolved_at
       or new.resolved_by is distinct from old.resolved_by
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status, notes, task check-offs, and delivery done counts on a work request'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 3) Work events → the work-event-email function.
-- ===========================================================================
create extension if not exists pg_net;

-- Server-side settings the triggers read (table from 20260907120000).
create table if not exists private.app_settings (
  key text primary key,
  value text not null
);

-- Post one event to the function. A silent no-op until the two settings
-- rows exist — the save that fired it must never fail.
create or replace function private.notify_work_event(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  select value into fn_url from private.app_settings
    where key = 'work_event_email_url';
  select value into secret from private.app_settings
    where key = 'work_event_email_secret';
  if fn_url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', secret
    ),
    body := payload
  );
end;
$$;

revoke all on function private.notify_work_event(jsonb) from public;

-- "Complete after, not before": delivered ≥ a set, non-zero total now, and
-- not already so before the edit. The app's countBecameComplete helper
-- applies the same rule for the in-app ping.
create or replace function private.count_became_complete(
  old_done integer,
  old_total integer,
  new_done integer,
  new_total integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (new_total is not null and new_total > 0
          and new_done is not null and new_done >= new_total)
     and not (old_total is not null and old_total > 0
              and old_done is not null and old_done >= old_total);
$$;

-- Work requests: priority → 'Now', and the card's own delivery count.
create or replace function private.notify_work_request_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  became_now boolean := false;
begin
  if TG_OP = 'INSERT' then
    became_now := new.priority = 'Now';
  else
    became_now := new.priority = 'Now' and old.priority is distinct from 'Now';
  end if;
  if became_now then
    perform private.notify_work_event(jsonb_build_object(
      'event', 'work_request_now',
      'work_request_id', new.id,
      'by', auth.uid(),
      'at', now()
    ));
  end if;

  if TG_OP = 'UPDATE' and private.count_became_complete(
       old.delivery_count_done, old.delivery_count_total,
       new.delivery_count_done, new.delivery_count_total
     ) then
    perform private.notify_work_event(jsonb_build_object(
      'event', 'delivery_complete',
      'work_request_id', new.id,
      'job_id', new.job_id,
      'count_label', 'Delivery Count',
      'on_site_label', 'Delivery complete — everything is on site',
      'delivered', new.delivery_count_done,
      'total', new.delivery_count_total,
      'by', auth.uid(),
      'at', now()
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists work_requests_notify_events on public.work_requests;
create trigger work_requests_notify_events
  after insert or update of priority, delivery_count_done, delivery_count_total
  on public.work_requests
  for each row execute function private.notify_work_request_events();

-- Jobs: each scope count's delivered number reaching its total.
create or replace function private.notify_job_delivery_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  def record;
begin
  for def in
    select * from (values
      ('window_count',     'Window Count',     'All Windows are On Site'),
      ('sgd_count',        'SGD Count',        'All SGDs are On Site'),
      ('mirror_count',     'Mirror Count',     'All Mirrors are On Site'),
      ('shower_count',     'Shower Count',     'All Showers are On Site'),
      ('swing_door_count', 'Swing Door Count', 'All Swing Doors are On Site'),
      ('screen_count',     'Screen Count',     'All Screens are On Site'),
      ('igu_count',        'IGU Count',        'All IGU''s are On Site')
    ) as d(prefix, label, on_site)
  loop
    if private.count_became_complete(
         (o ->> (def.prefix || '_delivered'))::integer,
         (o ->> (def.prefix || '_total'))::integer,
         (n ->> (def.prefix || '_delivered'))::integer,
         (n ->> (def.prefix || '_total'))::integer
       ) then
      perform private.notify_work_event(jsonb_build_object(
        'event', 'delivery_complete',
        'job_id', new.id,
        'count_label', def.label,
        'on_site_label', def.on_site,
        'delivered', (n ->> (def.prefix || '_delivered'))::integer,
        'total', (n ->> (def.prefix || '_total'))::integer,
        'by', auth.uid(),
        'at', now()
      ));
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists jobs_notify_delivery_events on public.jobs;
create trigger jobs_notify_delivery_events
  after update of
    window_count_delivered, window_count_total,
    sgd_count_delivered, sgd_count_total,
    mirror_count_delivered, mirror_count_total,
    shower_count_delivered, shower_count_total,
    swing_door_count_delivered, swing_door_count_total,
    screen_count_delivered, screen_count_total,
    igu_count_delivered, igu_count_total
  on public.jobs
  for each row execute function private.notify_job_delivery_events();

-- ===========================================================================
-- 3b) Phone push: 'delivery_complete' joins the pushed notification types,
--     so a Field Super hears about a completed delivery in the field, not
--     just at the bell. Previous definition: 20260923120000_calendar_tasks.sql.
--     (The push function itself doesn't filter by type; quiet hours apply.)
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
    'task_reminder',
    'delivery_complete'
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
-- 4) Priority escalation sweep (pg_cron).
-- ===========================================================================

-- "PO · <name>" — the same title the app gives work-request notifications
-- (the job's display name when it has no PO; the name alone on a standalone
-- request).
create or replace function private.work_request_notification_title(
  p_job_id uuid,
  p_name text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when j.id is null then p_name
    when nullif(trim(j.po), '') is not null then trim(j.po) || ' · ' || p_name
    when p.id is not null then p.name || ' ' || j.name || ' · ' || p_name
    else j.name || ' · ' || p_name
  end
  from (select 1) as one
  left join public.jobs j on j.id = p_job_id
  left join public.jobs p on p.id = j.parent_job_id;
$$;

revoke all on function private.work_request_notification_title(uuid, text) from public;

create or replace function private.escalate_due_work_request_priorities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due record;
  escalated integer := 0;
  ping_title text;
begin
  -- Claim every due card in one statement: its priority END date has
  -- arrived (Mountain time), it isn't Finished, and it isn't resolved. The
  -- AFTER UPDATE trigger above sends the "Now" email for each row.
  for due in
    update public.work_requests w
      set priority = 'Now'
      where w.priority is distinct from 'Now'
        and w.priority_end_date is not null
        and w.priority_end_date <= (now() at time zone 'America/Denver')::date
        and w.status is distinct from 'Finished'
        and w.resolved_at is null
      returning w.id, w.job_id, w.title
  loop
    escalated := escalated + 1;
    ping_title := private.work_request_notification_title(due.job_id, due.title);
    -- The schedulers' in-app ping (+ phone push via the notifications
    -- trigger) — what the app's own sweep would have sent.
    insert into public.notifications (recipient_id, type, title, body, data)
    select wk.id, 'work_request_now', ping_title, 'Priority: Now',
           jsonb_build_object('workRequestId', due.id)
    from public.workers wk
    where wk.role = 'scheduler';
  end loop;
  return escalated;
end;
$$;

revoke all on function private.escalate_due_work_request_priorities() from public;

create extension if not exists pg_cron;

-- Every 15 minutes. Re-running this migration replaces the job (same name)
-- instead of stacking a second one.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'work-request-priority-escalation'
  ) then
    perform cron.unschedule('work-request-priority-escalation');
  end if;
  perform cron.schedule(
    'work-request-priority-escalation',
    '*/15 * * * *',
    $job$ select private.escalate_due_work_request_priorities(); $job$
  );
end $$;
