-- Scheduler calendars, pencilled-in crews, and multi-day pool requests.
--
-- 1) crews.is_calendar — a Scheduler-made CALENDAR rather than an installer
--    crew: no members, no foreman, any-length name. Work schedules onto it
--    like a crew (own chip + color on the board) but nothing reaches any
--    installer. Default false, so every existing crew stays a crew.
--
-- 2) work_requests.end_date — the target END day of an unscheduled request
--    that should take more than one day; the Work Requests calendar
--    stretches it from `date` to here, and scheduling carries the length
--    over. Null = a single day. No `end_date >= date` check on purpose:
--    shipped clients that move `date` don't send `end_date`, and a stale
--    earlier end day must not reject their write — the app reads it as unset.
--
-- 3) work_requests.planned_crew_ids — "fake assign": the crew(s) the
--    Scheduler plans to give the request to while it still sits in the pool.
--    Not an assignment (schedule_assignments stays the single source of
--    truth for who actually works what); ids may reference a crew OR a daily
--    crew, so no FK — the app ignores ids that no longer resolve.
--
-- 4) Installer guard: the two new work_requests columns are office-only
--    (same list as 20260924120000_work_request_single_notes, plus them).

-- ===========================================================================
-- Columns
-- ===========================================================================
alter table public.crews
  add column if not exists is_calendar boolean not null default false;

alter table public.work_requests
  add column if not exists end_date date,
  add column if not exists planned_crew_ids uuid[];

-- ===========================================================================
-- Installer guard
-- ===========================================================================
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
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status, notes, task check-offs, and delivery done counts on a work request'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
