-- One Notes field on work requests.
--
-- Work requests used to carry two free-text note columns: `notes` (office
-- notes, Field Super / Scheduler authored, read-only to installers) and
-- `field_notes` (installer authored, read-only to the office). Each role only
-- ever saw its own box, so the two crews of authors talked past each other.
-- They collapse into the single `notes` column, editable by every role.
--
-- 1) Merge: any existing field notes are appended to the row's notes (notes
--    first, a blank line, then the field notes) so nothing typed on site is
--    lost. Rows with only one of the two keep that text as-is.
-- 2) Drop `field_notes`.
-- 3) Installer guard: `notes` leaves the blocklist so installers can write it.

-- ===========================================================================
-- Merge + drop
-- ===========================================================================
update public.work_requests
   set notes = case
                 when notes is null or btrim(notes) = '' then field_notes
                 else notes || E'\n\n' || field_notes
               end
 where field_notes is not null
   and btrim(field_notes) <> '';

alter table public.work_requests
  drop column if exists field_notes;

-- ===========================================================================
-- Installer guard: identical to 20260828120000_work_request_delivery_casements
-- minus the `notes` comparison — installers may now update notes.
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
