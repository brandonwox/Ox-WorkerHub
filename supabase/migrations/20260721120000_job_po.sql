-- Job PO numbers.
--
-- Every job and sub-job gets a "PO" typed by its creator (required at creation
-- in the app; legacy rows may stay empty). POs show next to job names in lists
-- and detail headers and are searchable wherever job names are.
--
-- Editing after creation stays an office concern: Operators and Field Supers
-- may change it; installers, schedulers, and finance managers may not (their
-- update guards below gain the po column — schedulers still CREATE jobs with a
-- PO, which is an insert and unaffected).

alter table public.jobs
  add column if not exists po text;

-- ===========================================================================
-- Installers: cover photo, flashing material, and the DONE counts. Schedulers:
-- cover photo + has_sub_jobs. Both now also blocked from po. (Latest previous
-- definition: 20260719170000_scopes_counts_videos.sql — this adds po to the
-- same blocklists.)
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
-- Finance managers: still QBT jobcode + labor budget + flashing only — pin
-- po too. (Latest previous definition: 20260719170000.)
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
       or new.scopes is distinct from old.scopes
       or new.cover_photo_id is distinct from old.cover_photo_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
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
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed then
      raise exception 'Finance managers may only edit the QBT jobcode, labor budget, and flashing material on a job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
