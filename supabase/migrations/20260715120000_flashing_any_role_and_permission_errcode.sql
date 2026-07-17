-- ===========================================================================
-- Two changes to the job/jobcard column guards.
--
-- 1. The flashing material and its photo are field data every role may record,
--    so they leave the installer/scheduler and finance-manager blocklists.
--    (Field Supers and Operators could already edit them.)
--
-- 2. Every guard that exists to enforce a ROLE now raises 42501
--    (insufficient_privilege) instead of the default P0001. That matches what
--    RLS itself returns, so the client can tell "you're not allowed to do this"
--    apart from a genuine failure and show the quiet permission message rather
--    than the loud "a change couldn't be saved" notification. Guards that
--    enforce DATA VALIDITY (sub-job nesting, crew membership) keep P0001 —
--    those are bugs, not permission problems.
-- ===========================================================================

-- Only an operator may change a worker's role or pay rate.
create or replace function private.guard_worker_role_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'operator' then
    if new.role is distinct from old.role
       or new.hourly_rate is distinct from old.hourly_rate then
      raise exception 'Only an operator can change a worker''s role or pay rate'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Field Supers: flashing material / photo / location / cover / has_sub_jobs.
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
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id then
      raise exception 'Field supers may not edit this job field'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Installers: cover photo + flashing material/photo. Schedulers: those plus
-- has_sub_jobs.
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
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or (
         private.current_app_role() = 'installer'
         and new.has_sub_jobs is distinct from old.has_sub_jobs
       ) then
      raise exception 'Only the cover photo and flashing material may be changed on a job by this role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Finance managers: QBT jobcode + labor budget + flashing material/photo.
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
       or new.scopes is distinct from old.scopes
       or new.cover_photo_id is distinct from old.cover_photo_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
       or new.parent_job_id is distinct from old.parent_job_id then
      raise exception 'Finance managers may only edit the QBT jobcode, labor budget, and flashing material on a job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Installers: jobcard status, field notes, and task check-offs only.
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
      raise exception 'Installers may only update status, field notes, and task check-offs on a jobcard'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
