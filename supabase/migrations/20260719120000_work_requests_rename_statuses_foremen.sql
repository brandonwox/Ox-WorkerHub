-- ===========================================================================
-- Pass 1: Jobcards become Work Requests — in the database too.
--
-- 1) RENAME: public.jobcards -> public.work_requests, every jobcard_id FK
--    column -> work_request_id, and every constraint / policy / trigger /
--    function still carrying the old name. The app is in development with no
--    production data, so the schema renames in lockstep with the product
--    language (no legacy aliases left behind). Realtime publication membership
--    survives a rename (it tracks the relation, not the name); the client now
--    subscribes to 'work_requests'.
--
-- 2) READINESS: the "Ready for installers" presets change from
--    Now / Soon / Over 2 Weeks to Yes / No / Soon. Existing values are mapped
--    (Now -> Yes, Over 2 Weeks -> No, Soon stays). Only "Yes" requests appear
--    in the scheduler backlog's main list; the rest sit in "Not ready yet".
--
-- 3) STATUSES: a new 'Undefined' status is the default until someone picks a
--    real one; 'No Progress' is removed. 'Untouched' and 'False Start' now
--    require a typed reason and 'Finished' carries a completion note — both
--    live in the new status_note column, alongside who/when stamps so the
--    field super and scheduler dashboards can review them.
--    undefined_reminder_date backs the 3:30 PM "status needs updating" sweep
--    (set when the day's reminder went out, so sessions don't re-ping).
--
-- 4) FOREMEN: crew_members.is_foreman tags exactly one installer per
--    PERMANENT crew as its foreman (the scheduler must pick one — no more, no
--    less; enforced in the app, with a partial unique index guaranteeing "at
--    most one" here). Only the foreman receives the 3:30 PM undefined-status
--    notification. Daily crews have no foreman.
-- ===========================================================================

-- ===========================================================================
-- 1) Rename table + FK columns.
-- ===========================================================================
alter table public.jobcards rename to work_requests;

alter table public.schedule_assignments rename column jobcard_id to work_request_id;
alter table public.timesheets           rename column jobcard_id to work_request_id;
alter table public.job_photos           rename column jobcard_id to work_request_id;
alter table public.job_issues           rename column jobcard_id to work_request_id;

-- Constraints (pkey, FKs, checks, uniques) that still say "jobcard" — renaming
-- a constraint also renames its backing index.
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conrelid <> 0
      and conname like '%jobcard%'
  loop
    execute format(
      'alter table %s rename constraint %I to %I',
      r.tbl,
      r.conname,
      replace(replace(r.conname, 'jobcards', 'work_requests'), 'jobcard', 'work_request')
    );
  end loop;
end $$;

-- Any standalone indexes named after jobcards (none today; future-proof).
do $$
declare r record;
begin
  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public' and indexname like '%jobcard%'
  loop
    execute format(
      'alter index public.%I rename to %I',
      r.indexname,
      replace(replace(r.indexname, 'jobcards', 'work_requests'), 'jobcard', 'work_request')
    );
  end loop;
end $$;

-- RLS policies (select/insert/update/delete across field super, installer,
-- operator, and scheduler).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname like '%jobcard%'
  loop
    execute format(
      'alter policy %I on %I.%I rename to %I',
      r.policyname,
      r.schemaname,
      r.tablename,
      replace(replace(r.policyname, 'jobcards', 'work_requests'), 'jobcard', 'work_request')
    );
  end loop;
end $$;

-- Helper + guard functions: recreate under work_request names (a plpgsql body
-- resolves callees by name at runtime, so the guard must reference the renamed
-- tasks helper), repoint the trigger, then drop the old pair.
create or replace function private.work_request_tasks_content(tasks jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg((elem - 'done' - 'doneById' - 'doneAt') order by ord)
      from jsonb_array_elements(coalesce(tasks, '[]'::jsonb))
        with ordinality as t(elem, ord)
    ),
    '[]'::jsonb
  );
$$;

-- Installers: status (+ its note/stamps), field notes, and task check-offs
-- only. Same blocklist as before — the new status_note / status_changed_* /
-- undefined_reminder_date columns are intentionally NOT listed, so installers
-- can write them.
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
       or new.notes is distinct from old.notes
       or new.scope_of_work is distinct from old.scope_of_work
       or new.pickup_required is distinct from old.pickup_required
       or new.pickup_location is distinct from old.pickup_location
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status, field notes, and task check-offs on a work request'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobcards_guard_installer_update on public.work_requests;
create trigger work_requests_guard_installer_update
  before update on public.work_requests
  for each row execute function private.guard_work_request_installer_update();

drop function if exists private.guard_jobcard_installer_update();
drop function if exists private.jobcard_tasks_content(jsonb);

-- Existing notification rows: the type value and payload key rename with the
-- entity so old pings keep deep-linking.
update public.notifications set type = 'work_request_now' where type = 'jobcard_now';
update public.notifications
  set data = (data - 'jobcardId') || jsonb_build_object('workRequestId', data->'jobcardId')
  where data ? 'jobcardId';

-- ===========================================================================
-- 2) Readiness presets: Now / Soon / Over 2 Weeks -> Yes / No / Soon.
-- ===========================================================================
update public.work_requests set readiness = 'Yes' where readiness = 'Now';
update public.work_requests set readiness = 'No'  where readiness = 'Over 2 Weeks';

-- ===========================================================================
-- 3) Statuses: 'Undefined' default, 'No Progress' removed, reason columns.
-- ===========================================================================
alter table public.work_requests drop constraint if exists work_requests_status_check;

-- Old default 'Untouched' meant "nobody reported yet" — that is exactly what
-- 'Undefined' now means (real Untouched reports require a typed reason from
-- here on). 'No Progress' is retired; those rows also need re-reporting.
update public.work_requests set status = 'Undefined'
  where status in ('Untouched', 'No Progress');

alter table public.work_requests
  add constraint work_requests_status_check
  check (status in ('Undefined', 'Untouched', 'False Start', 'Made Progress', 'Finished'));

alter table public.work_requests alter column status set default 'Undefined';

alter table public.work_requests
  add column if not exists status_note text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.workers (id) on delete set null,
  add column if not exists undefined_reminder_date date;

-- ===========================================================================
-- 4) Crew foremen (permanent crews only).
-- ===========================================================================
alter table public.crew_members
  add column if not exists is_foreman boolean not null default false;

-- At most one foreman per crew, guaranteed by the database; "exactly one" is
-- enforced by the app (the members table is written as delete-then-insert, so
-- a strict DB-side "exactly one" would reject every save mid-replace).
create unique index if not exists crew_members_one_foreman_per_crew
  on public.crew_members (crew_id)
  where is_foreman;
