-- Issues: Schedulers join the office roles that may edit, resolve, and delete
-- ANY issue (Field Supers and the Operator already could). Installers could
-- raise an issue on a work request that the office then couldn't clean up —
-- the UI (IssueCard) now offers edit/delete to the office roles, and these
-- policies let the writes through. Previous definitions: 20260724150000.

drop policy if exists job_issues_update on public.job_issues;
create policy job_issues_update on public.job_issues
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'installer', 'field_super', 'scheduler')
  )
  with check (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'installer', 'field_super', 'scheduler')
  );

drop policy if exists job_issues_delete on public.job_issues;
create policy job_issues_delete on public.job_issues
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'field_super', 'scheduler')
  );
