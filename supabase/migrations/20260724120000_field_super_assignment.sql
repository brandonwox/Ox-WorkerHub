-- Field Super assignment overhaul.
--
-- 1) Schedulers may now assign Field Supers — at job creation and afterwards.
--    The job_field_supers write policy widens from operator-only to
--    operator + scheduler.
-- 2) Field Supers may SELF-ASSIGN: they can insert (and remove) their OWN
--    job_field_supers row, so a super who needs a job they weren't given can
--    add themselves from the jobs pages.
-- 3) Field Supers can now SEE every job — the jobs pages gained a "view all
--    jobs" toggle. (20260724150000 then opens every job's content to them
--    too: assignment records responsibility, it no longer gates access.)
-- 4) job_field_supers.assigned_at records WHEN each assignment was made. The
--    job details surfaces now display the FIRST-assigned Field Super (falling
--    back to the next-oldest when the first is unassigned), so the order has
--    to be real and survive edits — the app also switched from
--    delete-all-then-reinsert to diffed assignment writes for this reason.

-- ===========================================================================
-- 4) Assignment timestamps. clock_timestamp() (not now()) so several supers
--    added in ONE statement still get distinct, ordered stamps. Existing rows
--    all get the migration's wall clock — indistinguishable from each other,
--    but every assignment from here on is ordered.
-- ===========================================================================
alter table public.job_field_supers
  add column assigned_at timestamptz not null default clock_timestamp();

-- ===========================================================================
-- 1) Operator + Scheduler manage assignments.
-- ===========================================================================
drop policy if exists job_field_supers_write_operator on public.job_field_supers;
create policy job_field_supers_write_office on public.job_field_supers
  for all to authenticated
  using ((select private.current_app_role()) in ('operator', 'scheduler'))
  with check ((select private.current_app_role()) in ('operator', 'scheduler'));

-- ===========================================================================
-- 2) Field Super self-assignment: only their OWN row, on any job. The delete
--    counterpart lets them undo a mis-tap (and step off a job themselves).
--    The sub-job mirror trigger runs as the same user, and mirrored rows also
--    carry their own field_super_id, so these policies cover the cascade too.
-- ===========================================================================
create policy job_field_supers_self_assign on public.job_field_supers
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'field_super'
    and field_super_id = (select auth.uid())
  );

create policy job_field_supers_self_unassign on public.job_field_supers
  for delete to authenticated
  using (
    (select private.current_app_role()) = 'field_super'
    and field_super_id = (select auth.uid())
  );

-- ===========================================================================
-- 3) Jobs are visible to every role again (back to the original blanket
--    SELECT — 20260702120000 had narrowed it for field supers). Everything
--    that hangs OFF a job keeps its assignment-scoped policies.
-- ===========================================================================
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated using (true);
