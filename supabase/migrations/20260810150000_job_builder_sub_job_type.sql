-- Job builder + sub-job type.
--
-- builder: the builder (general contractor/customer) the job is for. Free
-- text, edited in the job details edit view; the app offers past builders in a
-- dropdown but any new name may be typed. An office concern like the PO:
-- Operators and Field Supers may edit it; installers, schedulers, and finance
-- managers may not.
--
-- sub_job_type: what the job's sub-jobs are called — 'Lots', 'Phases',
-- 'Bldgs', or a custom term. Chosen when "This job has Sub-Jobs" is enabled
-- and used by the create-sub-job form to build names ("Lot 159"). Editable by
-- whoever may toggle has_sub_jobs (installers may not; schedulers may).

alter table public.jobs
  add column if not exists builder text,
  add column if not exists sub_job_type text;

-- ===========================================================================
-- Installers/Schedulers job guard: builder joins the shared blocklist;
-- sub_job_type is blocked for installers only (paired with has_sub_jobs —
-- schedulers manage sub-jobs). Latest previous definition:
-- 20260721180000_shower_layout_document_editing.sql.
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
-- Finance managers: pin builder + sub_job_type too. Latest previous
-- definition: 20260721180000_shower_layout_document_editing.sql.
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
