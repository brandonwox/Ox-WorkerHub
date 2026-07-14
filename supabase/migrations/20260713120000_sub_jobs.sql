-- Sub-Jobs.
--
-- A big job can be broken into pieces: sub-jobs are ordinary jobs rows that
-- carry a parent_job_id. They behave exactly like jobs (own QBT jobcode, own
-- jobcards, photos, issues, documents) with these rules:
--   - one level only: a sub-job cannot itself have sub-jobs.
--   - names are stored WITHOUT the parent's name; the app conjoins
--     "<parent> <sub>" where a combined display is wanted.
--   - Field Supers are applied to PARENT jobs only; sub-jobs inherit them.
--     Enforced by mirroring job_field_supers rows via triggers (below), so
--     every existing per-job RLS check keeps working unchanged for sub-jobs.
--   - schedulers and field supers may CREATE sub-jobs (field supers only under
--     their own jobs). Top-level job creation stays operator-only for now.
--   - "This job has Sub-Jobs" is a UI section toggle stored on the parent so
--     it persists for everyone; schedulers/field supers may flip it.
--   - deleting a parent cascades to its sub-jobs (and, transitively, to
--     everything hanging off them).

-- ===========================================================================
-- Columns
-- ===========================================================================
alter table public.jobs
  add column if not exists parent_job_id uuid references public.jobs (id) on delete cascade;
alter table public.jobs
  add column if not exists has_sub_jobs boolean not null default false;

create index if not exists jobs_parent_job_id_idx on public.jobs (parent_job_id);

-- ===========================================================================
-- One level only: a sub-job's parent must be a top-level job, and a job that
-- has sub-jobs can never become a sub-job itself.
-- ===========================================================================
create or replace function private.guard_sub_job_nesting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_job_id is not null then
    if new.parent_job_id = new.id then
      raise exception 'A job cannot be its own parent';
    end if;
    if exists (
      select 1 from public.jobs p
      where p.id = new.parent_job_id and p.parent_job_id is not null
    ) then
      raise exception 'Sub-jobs cannot have their own sub-jobs';
    end if;
    if exists (
      select 1 from public.jobs c where c.parent_job_id = new.id
    ) then
      raise exception 'A job with sub-jobs cannot become a sub-job';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_guard_sub_job_nesting
  before insert or update on public.jobs
  for each row execute function private.guard_sub_job_nesting();

-- ===========================================================================
-- Field Super inheritance: keep job_field_supers rows on every sub-job
-- mirroring its parent's. The join-table writes here run as SECURITY DEFINER,
-- so a scheduler/field-super-created sub-job still gets its rows despite the
-- table's operator-only write policy.
-- ===========================================================================

-- New sub-job → copy the parent's assignments.
create or replace function private.copy_parent_field_supers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_job_id is not null then
    insert into public.job_field_supers (job_id, field_super_id)
    select new.id, jfs.field_super_id
    from public.job_field_supers jfs
    where jfs.job_id = new.parent_job_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger jobs_copy_parent_field_supers
  after insert on public.jobs
  for each row execute function private.copy_parent_field_supers();

-- Parent assignment added/removed → mirror to its sub-jobs. The mirrored
-- writes fire this trigger again for the sub-job rows, but those recursive
-- invocations are no-ops (sub-jobs have no sub-jobs of their own).
create or replace function private.mirror_field_supers_to_sub_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_field_supers (job_id, field_super_id)
    select c.id, new.field_super_id
    from public.jobs c
    where c.parent_job_id = new.job_id
    on conflict do nothing;
    return new;
  else
    delete from public.job_field_supers jfs
    using public.jobs c
    where c.parent_job_id = old.job_id
      and jfs.job_id = c.id
      and jfs.field_super_id = old.field_super_id;
    return old;
  end if;
end;
$$;

create trigger job_field_supers_mirror_to_sub_jobs
  after insert or delete on public.job_field_supers
  for each row execute function private.mirror_field_supers_to_sub_jobs();

-- ===========================================================================
-- Creation: schedulers may insert sub-jobs; field supers may insert sub-jobs
-- under their own jobs. (Top-level creation stays operator-only.)
-- ===========================================================================
drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'operator'
    or (
      parent_job_id is not null
      and (
        (select private.current_app_role()) = 'scheduler'
        or (
          (select private.current_app_role()) = 'field_super'
          and exists (
            select 1 from public.job_field_supers jfs
            where jfs.job_id = jobs.parent_job_id
              and jfs.field_super_id = (select auth.uid())
          )
        )
      )
    )
  );

-- Schedulers had no jobs UPDATE policy of their own (only the cover-photo
-- shared one); they need one to flip has_sub_jobs. Column limits live in the
-- guards below.
create policy jobs_update_scheduler on public.jobs
  for update to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

-- ===========================================================================
-- Column guards: has_sub_jobs joins the Field Super's editable set; the
-- installer/scheduler cover-only guard becomes per-role so schedulers may
-- also flip has_sub_jobs (installers still cover-photo only). Both guards
-- must also pin the new parent_job_id column.
-- ===========================================================================

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
      raise exception 'Field supers may not edit this job field';
    end if;
  end if;
  return new;
end;
$$;

-- Installers: cover photo only. Schedulers: cover photo + has_sub_jobs.
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
       or (
         private.current_app_role() = 'installer'
         and new.has_sub_jobs is distinct from old.has_sub_jobs
       ) then
      raise exception 'Only the cover photo may be changed on a job by this role';
    end if;
  end if;
  return new;
end;
$$;

-- Finance managers: still QBT jobcode + labor budget only.
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
       or new.parent_job_id is distinct from old.parent_job_id then
      raise exception 'Finance managers may only edit the QBT jobcode and labor budget on a job';
    end if;
  end if;
  return new;
end;
$$;
