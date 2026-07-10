-- Let the Scheduler create and manage jobcards on any job.
--
-- The scheduler-jobcards desktop page lets the Scheduler create, edit, and
-- delete jobcards across EVERY job. Unlike a Field Super — scoped to their
-- assigned jobs via job_field_supers — the Scheduler isn't assigned to jobs at
-- all, so their write access is deliberately unscoped, mirroring the Operator's
-- admin-style policies (20260618150000_operator_write_access.sql). Permissive
-- RLS policies are OR'd, so every other role keeps exactly the access it had.
--
-- The column-guard trigger (guard_jobcard_installer_update) only restricts
-- installers, so Scheduler updates pass it untouched.

create policy jobcards_insert_scheduler on public.jobcards
  for insert to authenticated
  with check ((select private.current_app_role()) = 'scheduler');

create policy jobcards_update_scheduler on public.jobcards
  for update to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

create policy jobcards_delete_scheduler on public.jobcards
  for delete to authenticated
  using ((select private.current_app_role()) = 'scheduler');
