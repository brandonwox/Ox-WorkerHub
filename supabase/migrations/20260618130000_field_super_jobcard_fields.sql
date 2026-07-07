-- Field Super jobcard-creation overhaul.
--
-- The Field Super's Create-Jobcard form gained structured fields: a multi-select
-- of trade scopes, a list of discrete tasks, a "ready for installers" readiness
-- value, and a free-form notes field. Priority also became free text (the Field
-- Super picks a preset like 'Now' / 'This Week' or types a custom value), so the
-- original Low/Medium/High CHECK constraint no longer holds.

-- --- New columns -----------------------------------------------------------
alter table public.jobcards
  add column if not exists scopes    text[] not null default '{}',
  add column if not exists tasks     text[] not null default '{}',
  add column if not exists readiness text,
  add column if not exists notes     text;

-- --- Priority becomes free text -------------------------------------------
-- Drop the Low/Medium/High CHECK; keep a sane server-side default.
alter table public.jobcards drop constraint if exists jobcards_priority_check;
alter table public.jobcards alter column priority set default 'This Week';

-- --- Keep installers locked out of the new Field-Super-owned columns --------
-- Installers may still only change status / field_notes; extend the guard to
-- cover the new columns so an installer update can't touch them.
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
       or new.tasks is distinct from old.tasks
       or new.readiness is distinct from old.readiness
       or new.flashing_material is distinct from old.flashing_material
       or new.materials is distinct from old.materials
       or new.notes is distinct from old.notes
       or new.scope_of_work is distinct from old.scope_of_work
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status and field_notes on a jobcard';
    end if;
  end if;
  return new;
end;
$$;
