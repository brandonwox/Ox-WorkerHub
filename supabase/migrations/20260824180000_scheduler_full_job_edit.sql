-- Schedulers: full job-details editing, matching Field Supers.
--
-- The web job dashboard sidebar's Edit mode now offers Schedulers the same
-- form as Field Supers — job name, PO, jobsite address, flashing material,
-- scopes/counts, builder, and the assigned Field Supers — where their guard
-- previously allowed only the cover photo, flashing material, sub-job
-- settings, and archiving (even the done counts were pinned for them).
--
-- Concretely:
--   * private.guard_job_field_super_update widens to Schedulers and drops its
--     name + scopes pins: the job NAME becomes editable by both roles (new),
--     and scopes were already offered in the Field Super edit UI but rejected
--     here — a mismatch this fixes. Office/finance-only columns stay pinned:
--     status, QBT jobcode, labor budget, parent_job_id.
--   * private.guard_job_cover_only_update narrows to installers only, its
--     blocklist unchanged for them (the previously per-role pins fold into
--     the shared list; done counts stay installer-editable).
--   * job_field_supers writes were already open to Schedulers (20260814).
--
-- Latest previous definitions: 20260813120000_job_archive.sql (cover-only),
-- 20260715120000_flashing_any_role_and_permission_errcode.sql (field super).

-- ===========================================================================
-- Field Supers + Schedulers: everything except the office/finance columns.
-- ===========================================================================
create or replace function private.guard_job_field_super_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() in ('field_super', 'scheduler') then
    if new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id then
      raise exception 'This job field is office-only for your role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Installers: cover photo, flashing material/photo, and done counts only.
-- ===========================================================================
create or replace function private.guard_job_cover_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'installer' then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.po is distinct from old.po
       or new.builder is distinct from old.builder
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
       or new.sub_job_type is distinct from old.sub_job_type
       or new.archived_at is distinct from old.archived_at
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_total is distinct from old.igu_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
       or new.shower_layout_not_needed is distinct from old.shower_layout_not_needed then
      raise exception 'Only the cover photo and flashing material may be changed on a job by this role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
