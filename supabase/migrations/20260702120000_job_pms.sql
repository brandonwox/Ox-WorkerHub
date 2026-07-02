-- Project Manager ↔ Job assignments.
--
-- The Operator assigns one or more Project Managers to each job. A PM then sees
-- ONLY the jobs they're assigned to and — transitively — only the jobcards that
-- hang off those jobs. Every other role (operator, scheduler, installer) keeps
-- full visibility.
--
-- Modelled as a join table (mirrors crew_members): jobs :N ↔ N: workers.

-- ===========================================================================
-- Join table
-- ===========================================================================
create table public.job_pms (
  job_id uuid not null references public.jobs (id) on delete cascade,
  pm_id  uuid not null references public.workers (id) on delete cascade,
  primary key (job_id, pm_id)
);

-- Assigned PMs must actually have the project_manager role (defense in depth;
-- the Operator UI only ever offers project managers here).
create or replace function private.assert_project_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workers w
    where w.id = new.pm_id and w.role = 'project_manager'
  ) then
    raise exception 'job_pms.pm_id must reference a project_manager (worker % does not)', new.pm_id;
  end if;
  return new;
end;
$$;

create trigger job_pms_project_manager_only
  before insert or update on public.job_pms
  for each row execute function private.assert_project_manager();

-- ===========================================================================
-- Grants + RLS. Everyone authenticated may read the mapping (it drives the PM
-- scoping below); only the Operator may change it.
-- ===========================================================================
grant select, insert, update, delete on public.job_pms to authenticated;

alter table public.job_pms enable row level security;

create policy job_pms_read on public.job_pms
  for select to authenticated using (true);
create policy job_pms_write_operator on public.job_pms
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');

-- ===========================================================================
-- Scope jobs / jobcards visibility for Project Managers.
--
-- Replaces the blanket `using (true)` SELECT policies: a PM now sees only their
-- assigned jobs and those jobs' jobcards. All other roles are unaffected.
-- ===========================================================================
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'project_manager'
    or exists (
      select 1 from public.job_pms jp
      where jp.job_id = jobs.id and jp.pm_id = (select auth.uid())
    )
  );

drop policy if exists jobcards_select on public.jobcards;
create policy jobcards_select on public.jobcards
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'project_manager'
    or exists (
      select 1 from public.job_pms jp
      where jp.job_id = jobcards.job_id and jp.pm_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- Tighten PM jobcard writes to their own jobs (they could previously write any
-- jobcard). The Operator's own jobcard write policies are unchanged.
-- ===========================================================================
drop policy if exists jobcards_insert on public.jobcards;
create policy jobcards_insert on public.jobcards
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'project_manager'
    and exists (
      select 1 from public.job_pms jp
      where jp.job_id = jobcards.job_id and jp.pm_id = (select auth.uid())
    )
  );

drop policy if exists jobcards_update_pm on public.jobcards;
create policy jobcards_update_pm on public.jobcards
  for update to authenticated
  using (
    (select private.current_app_role()) = 'project_manager'
    and exists (
      select 1 from public.job_pms jp
      where jp.job_id = jobcards.job_id and jp.pm_id = (select auth.uid())
    )
  )
  with check (
    (select private.current_app_role()) = 'project_manager'
    and exists (
      select 1 from public.job_pms jp
      where jp.job_id = jobcards.job_id and jp.pm_id = (select auth.uid())
    )
  );

drop policy if exists jobcards_delete on public.jobcards;
create policy jobcards_delete on public.jobcards
  for delete to authenticated
  using (
    (select private.current_app_role()) = 'project_manager'
    and exists (
      select 1 from public.job_pms jp
      where jp.job_id = jobcards.job_id and jp.pm_id = (select auth.uid())
    )
  );
