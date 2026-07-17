-- Top-level job creation for Schedulers and Field Supers.
--
-- Previously only the Operator could create top-level jobs (schedulers and
-- field supers were limited to sub-jobs). Now:
--   - schedulers may create any job (top-level or sub-job).
--   - field supers may create top-level jobs, and sub-jobs under their own
--     jobs (unchanged).
--   - non-operator creations must leave the finance columns empty: no QBT
--     jobcode id and no labor budget — the Finance Manager fills the jobcode
--     in later (the job shows in their "missing QBT jobcode ID" list).
--   - a field super who creates a top-level job is AUTO-ASSIGNED to it.
--     Field supers only see their assigned jobs (jobs_select) and can't write
--     the operator-only job_field_supers table, so a SECURITY DEFINER trigger
--     adds the row — mirroring the sub-jobs inheritance pattern.

-- ===========================================================================
-- Creation policy
-- ===========================================================================
drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'operator'
    or (
      -- Schedulers / Field Supers create jobs without the finance fields.
      qbt_jobcode_id is null
      and labor_budget is null
      and (
        (select private.current_app_role()) = 'scheduler'
        or (
          (select private.current_app_role()) = 'field_super'
          and (
            -- Top-level jobs are free to create (the trigger below assigns
            -- the creator); sub-jobs still only under their own jobs.
            parent_job_id is null
            or exists (
              select 1 from public.job_field_supers jfs
              where jfs.job_id = jobs.parent_job_id
                and jfs.field_super_id = (select auth.uid())
            )
          )
        )
      )
    )
  );

-- ===========================================================================
-- Auto-assign the creating Field Super to their new top-level job.
-- (Sub-jobs are covered by private.copy_parent_field_supers instead.)
-- ===========================================================================
create or replace function private.assign_creator_field_super()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_job_id is null
     and private.current_app_role() = 'field_super' then
    insert into public.job_field_supers (job_id, field_super_id)
    values (new.id, (select auth.uid()))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger jobs_assign_creator_field_super
  after insert on public.jobs
  for each row execute function private.assign_creator_field_super();
