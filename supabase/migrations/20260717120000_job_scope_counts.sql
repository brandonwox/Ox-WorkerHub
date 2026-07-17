-- Scope-driven job counts: Window Count + SGD Count (Windows scope) and
-- Mirror Count (Mirrors scope). Each is a done/total pair displayed as
-- "0/100" on the job details page and every jobcard of the job.
--
-- Who writes what:
--   - totals are office-set: the Operator and Field Supers (Field Supers'
--     column guard already allows any column not explicitly blocked).
--   - installers update only the DONE numbers (from the jobcard popup); the
--     rest of the row stays under the existing cover-photo-only guard.
--   - schedulers and the finance manager can't touch either.

-- ===========================================================================
-- Columns
-- ===========================================================================
alter table public.jobs
  add column if not exists window_count_done integer,
  add column if not exists window_count_total integer,
  add column if not exists sgd_count_done integer,
  add column if not exists sgd_count_total integer,
  add column if not exists mirror_count_done integer,
  add column if not exists mirror_count_total integer;

-- ===========================================================================
-- Installers: cover photo + the three DONE counts. Schedulers: cover photo +
-- has_sub_jobs (unchanged). Totals stay blocked for both. (Latest previous
-- definition: 20260713120000_sub_jobs.sql.)
-- ===========================================================================
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
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_total is distinct from old.mirror_count_total
       or (
         private.current_app_role() = 'installer'
         and new.has_sub_jobs is distinct from old.has_sub_jobs
       )
       or (
         private.current_app_role() = 'scheduler'
         and (
           new.window_count_done is distinct from old.window_count_done
           or new.sgd_count_done is distinct from old.sgd_count_done
           or new.mirror_count_done is distinct from old.mirror_count_done
         )
       ) then
      raise exception 'Only the cover photo may be changed on a job by this role';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Finance managers: still QBT jobcode + labor budget only — pin the new
-- count columns too. (Latest previous definition: 20260713120000_sub_jobs.sql.)
-- ===========================================================================
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
       or new.cover_photo_id is distinct from old.cover_photo_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_done is distinct from old.window_count_done
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_done is distinct from old.sgd_count_done
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_done is distinct from old.mirror_count_done
       or new.mirror_count_total is distinct from old.mirror_count_total then
      raise exception 'Finance managers may only edit the QBT jobcode and labor budget on a job';
    end if;
  end if;
  return new;
end;
$$;
