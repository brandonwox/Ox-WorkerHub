-- Delivery scope + Windows casements on work requests.
--
-- 1) work_requests.delivery_count_total / delivery_count_done: the per-card
--    delivery count that must be set as soon as the (request-only) 'Delivery'
--    scope is selected. The total is office-set; installers update the done
--    number from their phone — mirroring the job scope counts' split.
-- 2) work_requests.windows_casements: the "Are any of the Windows Casements?"
--    answer, asked while the Windows scope is selected (checking it auto-adds
--    the gather-casement-cranks task app-side).
--
-- ('Delivery' needs no scopes-column change — scopes is an unconstrained
-- text[].)

-- ===========================================================================
-- Columns
-- ===========================================================================
alter table public.work_requests
  add column if not exists delivery_count_total integer,
  add column if not exists delivery_count_done integer,
  add column if not exists windows_casements boolean;

-- ===========================================================================
-- Installer guard: the office-set delivery TOTAL and the casements answer join
-- the blocklist; delivery_count_done is intentionally NOT listed so installers
-- can write it (like the jobs table's done counts). (Latest previous
-- definition: 20260719120000_work_requests_rename_statuses_foremen.sql.)
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
       or new.notes is distinct from old.notes
       or new.scope_of_work is distinct from old.scope_of_work
       or new.pickup_required is distinct from old.pickup_required
       or new.pickup_location is distinct from old.pickup_location
       or new.delivery_count_total is distinct from old.delivery_count_total
       or new.windows_casements is distinct from old.windows_casements
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status, field notes, task check-offs, and delivery done counts on a work request'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
