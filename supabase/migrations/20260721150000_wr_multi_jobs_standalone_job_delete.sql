-- Work request job links + job deletion permissions.
--
-- 1) Multi-sub-job work requests: a card may link several sibling sub-jobs of
--    one parent (optionally the parent itself — never two different parents).
--    New `job_ids uuid[]` holds the full list; `job_id` stays the primary
--    link (always the array's first entry) so the FK cascade, Field Super
--    scoping, and every existing policy keep working unchanged. The array is
--    not FK-checked: a deleted sub-job may leave a stale id behind, which the
--    app ignores at display time.
--
-- 2) Standalone work requests: a card may be created with NO parent job
--    (job_id null, address typed by hand). The Field Super policies were
--    scoped strictly to assigned jobs, which made null-job rows invisible and
--    unwritable for them — each policy now also accepts `job_id is null`.
--    Scheduler / operator policies are unscoped and already handle null.
--
-- 3) Job deletion: previously operator-only. Schedulers may now delete any
--    job; Field Supers their assigned jobs (sub-jobs inherit the parent's
--    assignments via the mirror trigger, so the direct check covers both).
--    Deleting a job cascades its sub-jobs (parent_job_id FK) and their work
--    requests (job_id FK) — referential cascades are not blocked by RLS.

-- ===========================================================================
-- 1) Multi-job link column
-- ===========================================================================
alter table public.work_requests
  add column if not exists job_ids uuid[];

-- ===========================================================================
-- 2) Field Super work request policies: allow standalone (null job) cards
-- ===========================================================================
drop policy if exists work_requests_select on public.work_requests;
create policy work_requests_select on public.work_requests
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'field_super'
    or work_requests.job_id is null
    or exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = work_requests.job_id
        and jfs.field_super_id = (select auth.uid())
    )
  );

drop policy if exists work_requests_insert on public.work_requests;
create policy work_requests_insert on public.work_requests
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'field_super'
    and (
      work_requests.job_id is null
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = work_requests.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

drop policy if exists work_requests_update_field_super on public.work_requests;
create policy work_requests_update_field_super on public.work_requests
  for update to authenticated
  using (
    (select private.current_app_role()) = 'field_super'
    and (
      work_requests.job_id is null
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = work_requests.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  )
  with check (
    (select private.current_app_role()) = 'field_super'
    and (
      work_requests.job_id is null
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = work_requests.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

drop policy if exists work_requests_delete on public.work_requests;
create policy work_requests_delete on public.work_requests
  for delete to authenticated
  using (
    (select private.current_app_role()) = 'field_super'
    and (
      work_requests.job_id is null
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = work_requests.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- 3) Job deletion for Schedulers and Field Supers
-- ===========================================================================
drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete to authenticated
  using (
    (select private.current_app_role()) in ('operator', 'scheduler')
    or (
      (select private.current_app_role()) = 'field_super'
      and exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = jobs.id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );
