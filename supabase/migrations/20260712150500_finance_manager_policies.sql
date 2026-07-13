-- Finance Manager role, part 2 of 2: policies + guards.
--
-- Grants the finance_manager role:
--   - full timesheet visibility/edit (what the Operator had; the Operator
--     keeps DB access for safety, the app moves the page).
--   - jobs UPDATE limited to qbt_jobcode_id + labor_budget (guard trigger).
-- Also adds labor_budget to the existing per-role job guards so Field Supers
-- and installers/schedulers can't write the budget through their policies.

-- ===========================================================================
-- Timesheets: finance manager reviews/edits everyone's rows.
-- ===========================================================================
drop policy if exists timesheets_select on public.timesheets;
create policy timesheets_select on public.timesheets
  for select to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'finance_manager')
  );

drop policy if exists timesheets_update on public.timesheets;
create policy timesheets_update on public.timesheets
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'finance_manager')
  )
  with check (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'finance_manager')
  );

drop policy if exists timesheets_delete on public.timesheets;
create policy timesheets_delete on public.timesheets
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'finance_manager')
  );

-- ===========================================================================
-- Jobs: finance manager updates ONLY qbt_jobcode_id + labor_budget.
-- ===========================================================================
create policy jobs_update_finance on public.jobs
  for update to authenticated
  using ((select private.current_app_role()) = 'finance_manager')
  with check ((select private.current_app_role()) = 'finance_manager');

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
       or new.flashing_material is distinct from old.flashing_material
       or new.flashing_photo_path is distinct from old.flashing_photo_path
       or new.scopes is distinct from old.scopes
       or new.cover_photo_id is distinct from old.cover_photo_id then
      raise exception 'Finance managers may only edit the QBT jobcode and labor budget on a job';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_guard_finance_update
  before update on public.jobs
  for each row execute function private.guard_job_finance_update();

-- ===========================================================================
-- Keep labor_budget out of the other limited-role job guards.
-- ===========================================================================

-- Field Supers: flashing material / photo / location / cover only.
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
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget then
      raise exception 'Field supers may not edit this job field';
    end if;
  end if;
  return new;
end;
$$;

-- Installers/schedulers: cover photo only (now also blocking labor_budget).
create or replace function private.guard_job_cover_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() in ('installer', 'scheduler') then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.flashing_material is distinct from old.flashing_material
       or new.flashing_photo_path is distinct from old.flashing_photo_path
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget then
      raise exception 'Only the cover photo may be changed on a job by this role';
    end if;
  end if;
  return new;
end;
$$;
