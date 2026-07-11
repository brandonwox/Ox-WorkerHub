-- Job scopes + jobcard pickup fields + Field Super address edits.
--
-- 1) jobs.scopes: the trade scopes a job covers (Windows, Mirrors, …), picked
--    by the Operator at creation and editable later. When the set excludes
--    'Windows', the Window Opening Flashing Material is hidden everywhere for
--    the job and its jobcards. NULL/empty = legacy "not narrowed" (all allowed).
--
-- 2) jobcards.pickup_required / pickup_location: the Field Super answers
--    Yes/No at creation; Yes requires a location. Installers read these on
--    their jobcard view.
--
-- 3) Field Supers may now edit a job's location (jobsite address): the app has
--    them own the address (and jobcard creation is blocked until it's set), but
--    the original guard still blocklisted the column.

alter table public.jobs add column if not exists scopes text[];
alter table public.jobcards add column if not exists pickup_required boolean;
alter table public.jobcards add column if not exists pickup_location text;

-- ===========================================================================
-- Field Super job guard: allow location edits (drop it from the blocklist).
-- `scopes` joins the blocklist — job scopes are Operator-owned.
-- ===========================================================================
create or replace function private.guard_job_field_super_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'field_super' then
    if new.name is distinct from old.name
       or new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.scopes is distinct from old.scopes then
      raise exception 'Field supers may only edit location, flashing material, and the flashing photo on a job';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Installer jobcard guard: pickup fields join the read-only list (installers
-- still only update status, field notes, and task check-offs).
-- ===========================================================================
create or replace function private.guard_jobcard_installer_update()
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
       or private.jobcard_tasks_content(new.tasks)
          is distinct from private.jobcard_tasks_content(old.tasks)
       or new.readiness is distinct from old.readiness
       or new.flashing_material is distinct from old.flashing_material
       or new.materials is distinct from old.materials
       or new.notes is distinct from old.notes
       or new.scope_of_work is distinct from old.scope_of_work
       or new.pickup_required is distinct from old.pickup_required
       or new.pickup_location is distinct from old.pickup_location
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status, field notes, and task check-offs on a jobcard';
    end if;
  end if;
  return new;
end;
$$;
