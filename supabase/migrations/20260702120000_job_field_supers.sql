-- Field Super ↔ Job assignments.
--
-- The Operator assigns one or more Field Supers to each job. A Field Super then
-- sees ONLY the jobs they're assigned to and — transitively — only the jobcards
-- that hang off those jobs. Every other role (operator, scheduler, installer)
-- keeps full visibility.
--
-- Modelled as a join table (mirrors crew_members): jobs :N ↔ N: workers.

-- ===========================================================================
-- Join table
-- ===========================================================================
create table public.job_field_supers (
  job_id         uuid not null references public.jobs (id) on delete cascade,
  field_super_id uuid not null references public.workers (id) on delete cascade,
  primary key (job_id, field_super_id)
);

-- Assigned Field Supers must actually have the field_super role (defense in
-- depth; the Operator UI only ever offers field supers here).
create or replace function private.assert_field_super()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workers w
    where w.id = new.field_super_id and w.role = 'field_super'
  ) then
    raise exception 'job_field_supers.field_super_id must reference a field_super (worker % does not)', new.field_super_id;
  end if;
  return new;
end;
$$;

create trigger job_field_supers_field_super_only
  before insert or update on public.job_field_supers
  for each row execute function private.assert_field_super();

-- ===========================================================================
-- Grants + RLS. Everyone authenticated may read the mapping (it drives the
-- Field Super scoping below); only the Operator may change it.
-- ===========================================================================
grant select, insert, update, delete on public.job_field_supers to authenticated;

alter table public.job_field_supers enable row level security;

create policy job_field_supers_read on public.job_field_supers
  for select to authenticated using (true);
create policy job_field_supers_write_operator on public.job_field_supers
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');

-- ===========================================================================
-- Scope jobs / jobcards visibility for Field Supers.
--
-- Replaces the blanket `using (true)` SELECT policies: a Field Super now sees
-- only their assigned jobs and those jobs' jobcards. All other roles are
-- unaffected.
-- ===========================================================================
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'field_super'
    or exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = jobs.id and jfs.field_super_id = (select auth.uid())
    )
  );

drop policy if exists jobcards_select on public.jobcards;
create policy jobcards_select on public.jobcards
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'field_super'
    or exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = jobcards.job_id and jfs.field_super_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- Tighten Field Super jobcard writes to their own jobs (they could previously
-- write any jobcard). The Operator's own jobcard write policies are unchanged.
-- ===========================================================================
drop policy if exists jobcards_insert on public.jobcards;
create policy jobcards_insert on public.jobcards
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'field_super'
    and exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = jobcards.job_id and jfs.field_super_id = (select auth.uid())
    )
  );

drop policy if exists jobcards_update_field_super on public.jobcards;
create policy jobcards_update_field_super on public.jobcards
  for update to authenticated
  using (
    (select private.current_app_role()) = 'field_super'
    and exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = jobcards.job_id and jfs.field_super_id = (select auth.uid())
    )
  )
  with check (
    (select private.current_app_role()) = 'field_super'
    and exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = jobcards.job_id and jfs.field_super_id = (select auth.uid())
    )
  );

drop policy if exists jobcards_delete on public.jobcards;
create policy jobcards_delete on public.jobcards
  for delete to authenticated
  using (
    (select private.current_app_role()) = 'field_super'
    and exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = jobcards.job_id and jfs.field_super_id = (select auth.uid())
    )
  );
