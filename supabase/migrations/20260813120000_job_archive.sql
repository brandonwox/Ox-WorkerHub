-- Job archive: "deleting" a job now archives it instead of destroying it.
--
-- jobs.archived_at (timestamptz, null = active): set when a job is archived,
-- cleared on restore. Archived jobs (and their work requests) disappear from
-- every active surface in the app and live in the jobs pages' Archived
-- section, where they can be restored or PERMANENTLY deleted (the old DELETE,
-- which still cascades sub-jobs and work requests). Distinct from status
-- 'Finished', which stays visible. Sub-jobs archive/restore with their parent
-- (the app writes the whole family).
--
-- Who may archive/restore = who may delete: the Operator, Schedulers, and
-- Field Supers. Archiving is a jobs UPDATE, so the existing update policies
-- already admit those roles — the guards below just pin archived_at for the
-- roles that may NOT touch it (installers, finance managers).

alter table public.jobs
  add column if not exists archived_at timestamptz;

-- ===========================================================================
-- Installers/Schedulers job guard: archived_at joins the installer-only
-- blocklist (schedulers may archive — they may delete). Latest previous
-- definition: 20260810150000_job_builder_sub_job_type.sql.
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
       or new.po is distinct from old.po
       or new.builder is distinct from old.builder
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_total is distinct from old.igu_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
       or new.shower_layout_not_needed is distinct from old.shower_layout_not_needed
       or (
         private.current_app_role() = 'installer'
         and (
           new.has_sub_jobs is distinct from old.has_sub_jobs
           or new.sub_job_type is distinct from old.sub_job_type
           or new.archived_at is distinct from old.archived_at
         )
       )
       or (
         private.current_app_role() = 'scheduler'
         and (
           new.window_count_done is distinct from old.window_count_done
           or new.sgd_count_done is distinct from old.sgd_count_done
           or new.mirror_count_done is distinct from old.mirror_count_done
           or new.shower_count_done is distinct from old.shower_count_done
           or new.swing_door_count_done is distinct from old.swing_door_count_done
           or new.screen_count_done is distinct from old.screen_count_done
           or new.igu_count_done is distinct from old.igu_count_done
         )
       ) then
      raise exception 'Only the cover photo and flashing material may be changed on a job by this role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Finance managers: pin archived_at too. Latest previous definition:
-- 20260810150000_job_builder_sub_job_type.sql.
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
       or new.sgd_count_done is distinct from old.sgd_count_done
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_done is distinct from old.mirror_count_done
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.shower_count_done is distinct from old.shower_count_done
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_done is distinct from old.swing_door_count_done
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_done is distinct from old.screen_count_done
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_done is distinct from old.igu_count_done
       or new.igu_count_total is distinct from old.igu_count_total
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
