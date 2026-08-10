-- Field Supers: full view AND edit on EVERY job (decision revision, same day
-- as 20260724120000_field_super_assignment).
--
-- Assignment no longer gates what a Field Super can do — it only records who
-- is RESPONSIBLE for a job (the first-assigned super is the displayed name,
-- and the jobs pages still list assigned jobs by default until "All jobs" is
-- toggled). A super helping out on someone else's job for a day just opens it
-- and works — no assign/unassign dance.
--
-- Concretely: every policy that scoped a Field Super's SELECT or writes to
-- their assigned jobs (via a job_field_supers EXISTS check) loses that check.
-- Two things intentionally KEEP the assignment scope:
--   * jobs_delete — deleting a job (cascading its sub-jobs + work requests)
--     stays with the supers responsible for it (and operator/scheduler).
--   * job_field_supers self-writes — a super still only writes their OWN
--     assignment row (see 20260724120000).

-- ===========================================================================
-- jobs: sub-job creation under ANY parent (was: only under their own jobs).
-- Top-level creation, the finance-fields-null rule, and the creator
-- auto-assign trigger are unchanged.
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
      and (select private.current_app_role()) in ('scheduler', 'field_super')
    )
  );

-- ===========================================================================
-- work_requests: back to blanket SELECT; the Field Super write policies drop
-- their assignment scope (other roles' policies are separate and unchanged).
-- ===========================================================================
drop policy if exists work_requests_select on public.work_requests;
create policy work_requests_select on public.work_requests
  for select to authenticated using (true);

drop policy if exists work_requests_insert on public.work_requests;
create policy work_requests_insert on public.work_requests
  for insert to authenticated
  with check ((select private.current_app_role()) = 'field_super');

drop policy if exists work_requests_update_field_super on public.work_requests;
create policy work_requests_update_field_super on public.work_requests
  for update to authenticated
  using ((select private.current_app_role()) = 'field_super')
  with check ((select private.current_app_role()) = 'field_super');

drop policy if exists work_requests_delete on public.work_requests;
create policy work_requests_delete on public.work_requests
  for delete to authenticated
  using ((select private.current_app_role()) = 'field_super');

-- ===========================================================================
-- job_photos
-- ===========================================================================
drop policy if exists job_photos_select on public.job_photos;
create policy job_photos_select on public.job_photos
  for select to authenticated using (true);

drop policy if exists job_photos_insert on public.job_photos;
create policy job_photos_insert on public.job_photos
  for insert to authenticated
  with check (worker_id = (select auth.uid()));

drop policy if exists job_photos_delete on public.job_photos;
create policy job_photos_delete on public.job_photos
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'field_super')
  );

-- ===========================================================================
-- job_issues
-- ===========================================================================
drop policy if exists job_issues_select on public.job_issues;
create policy job_issues_select on public.job_issues
  for select to authenticated using (true);

drop policy if exists job_issues_insert on public.job_issues;
create policy job_issues_insert on public.job_issues
  for insert to authenticated
  with check (worker_id = (select auth.uid()));

drop policy if exists job_issues_update on public.job_issues;
create policy job_issues_update on public.job_issues
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'installer', 'field_super')
  )
  with check (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'installer', 'field_super')
  );

drop policy if exists job_issues_delete on public.job_issues;
create policy job_issues_delete on public.job_issues
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'field_super')
  );

-- ===========================================================================
-- job_documents
-- ===========================================================================
drop policy if exists job_documents_select on public.job_documents;
create policy job_documents_select on public.job_documents
  for select to authenticated using (true);

drop policy if exists job_documents_insert on public.job_documents;
create policy job_documents_insert on public.job_documents
  for insert to authenticated
  with check (
    worker_id = (select auth.uid())
    and (select private.current_app_role()) <> 'installer'
  );

drop policy if exists job_documents_update on public.job_documents;
create policy job_documents_update on public.job_documents
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'field_super')
  )
  with check (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'field_super')
  );

drop policy if exists job_documents_delete on public.job_documents;
create policy job_documents_delete on public.job_documents
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'field_super')
  );
