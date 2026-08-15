-- Field Supers may now MANAGE a job's Field Super assignments — not just
-- self-assign/unassign (Dev Tracker: "when editing the job details … allow the
-- user to change the assigned field supers").
--
-- The job details editors (web job dashboard sidebar's Edit mode, and the
-- phone jobs list's inline editor) gained a Field Supers picker, which writes
-- the full assignment list through the same diffed setJobFieldSupers path the
-- office roles use. That needs field supers to insert/delete ANY row in
-- job_field_supers, so the write policy widens from operator + scheduler to
-- operator + scheduler + field_super.
--
-- The 20260724120000 self-assign/unassign policies become redundant subsets of
-- the widened policy, so they're dropped here to keep the policy set flat.
-- The assert_field_super trigger still guarantees only field_super workers can
-- ever be assigned.

drop policy if exists job_field_supers_write_office on public.job_field_supers;
drop policy if exists job_field_supers_self_assign on public.job_field_supers;
drop policy if exists job_field_supers_self_unassign on public.job_field_supers;

create policy job_field_supers_write on public.job_field_supers
  for all to authenticated
  using (
    (select private.current_app_role()) in ('operator', 'scheduler', 'field_super')
  )
  with check (
    (select private.current_app_role()) in ('operator', 'scheduler', 'field_super')
  );
