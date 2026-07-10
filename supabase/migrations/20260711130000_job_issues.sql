-- Job issues (installer-raised field problems).
--
-- An installer flags an issue from a jobcard's screen (missing material, site
-- not ready, damage, …). The issue belongs to the parent JOB — the job's page
-- lists every issue with a link back to the jobcard it was raised on — and
-- keeps a reference to that jobcard. Photos documenting an issue are ordinary
-- job_photos rows carrying the new issue_id column, so they ride the existing
-- upload queue, storage bucket, and RLS.
--
-- Permissions: anyone who can see the job may raise an issue (as themselves).
-- The creator edits/deletes their own issue; Field Supers (scoped to their
-- jobs) resolve/reopen or clean up; the Operator can do anything.

-- ===========================================================================
-- Table
-- ===========================================================================
create table public.job_issues (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  -- The jobcard the issue was raised on; survives that card's deletion (the
  -- issue still documents the jobsite), mirroring job_photos.jobcard_id.
  jobcard_id  uuid references public.jobcards (id) on delete set null,
  worker_id   uuid not null references public.workers (id) on delete cascade,
  description text not null default '',
  status      text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.workers (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index job_issues_job_id_idx on public.job_issues (job_id);

-- Photos documenting an issue. Deleting the issue keeps the photos as plain
-- job photos (no data loss); the app filters issue photos out of the general
-- grids while the link exists.
alter table public.job_photos
  add column if not exists issue_id uuid references public.job_issues (id) on delete set null;

create index job_photos_issue_id_idx on public.job_photos (issue_id);

-- ===========================================================================
-- Grants + RLS
-- ===========================================================================
grant select, insert, update, delete on public.job_issues to authenticated;

alter table public.job_issues enable row level security;

-- Everyone sees a job's issues except Field Supers, who are scoped to their
-- own jobs (mirrors job_photos_select).
create policy job_issues_select on public.job_issues
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'field_super'
    or exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = job_issues.job_id
        and jfs.field_super_id = (select auth.uid())
    )
  );

-- Anyone may raise an issue on a job they can see, but only as themselves.
create policy job_issues_insert on public.job_issues
  for insert to authenticated
  with check (
    worker_id = (select auth.uid())
    and (
      (select private.current_app_role()) <> 'field_super'
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_issues.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- The creator edits their own issue; Field Supers resolve issues on their
-- jobs; the Operator may edit anything.
create policy job_issues_update on public.job_issues
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
    or (
      (select private.current_app_role()) = 'field_super'
      and exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_issues.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  )
  with check (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
    or (
      (select private.current_app_role()) = 'field_super'
      and exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_issues.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- Creators delete their own issues; Field Supers clean up on their jobs; the
-- Operator can delete anything.
create policy job_issues_delete on public.job_issues
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
    or (
      (select private.current_app_role()) = 'field_super'
      and exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_issues.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- Realtime — issues another crew member raises/resolves stream into sessions.
-- ===========================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_issues'
  ) then
    alter publication supabase_realtime add table public.job_issues;
  end if;
end $$;
