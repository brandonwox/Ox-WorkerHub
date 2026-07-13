-- Job documents + job cover photo.
--
-- 1) jobs.cover_photo_id — the photo shown as the job's cover on its details
--    page. Defaults in the app to the job's OLDEST photo until someone picks
--    one explicitly ("Change jobsite photo"). Any signed-in worker may set it:
--    installers/schedulers get a dedicated UPDATE policy whose guard trigger
--    rejects changes to anything except this column.
--
-- 2) job_documents — office-facing files attached to a job: a photo, a PDF, or
--    a plain text note. Everyone can view (Field Supers scoped to their own
--    jobs, mirroring job_photos); installers cannot create documents. File
--    bytes live in the new `job-documents` bucket (public reads, like
--    job-photos) at "<job_id>/doc-<document_id>.<ext>".

-- ===========================================================================
-- Job cover photo column
-- ===========================================================================
alter table public.jobs
  add column if not exists cover_photo_id uuid references public.job_photos (id) on delete set null;

-- Installers and schedulers may update a jobs row ONLY to change the cover
-- photo (guarded below). Operators/Field Supers keep their existing policies.
create policy jobs_update_cover on public.jobs
  for update to authenticated
  using ((select private.current_app_role()) in ('installer', 'scheduler'))
  with check ((select private.current_app_role()) in ('installer', 'scheduler'));

-- Blocklist every other column for installer/scheduler updates (mirrors
-- private.guard_job_field_super_update — the app sends whole rows, unchanged
-- columns pass `is distinct from`).
create or replace function private.guard_job_cover_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() in ('installer', 'scheduler') then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.flashing_material is distinct from old.flashing_material
       or new.flashing_photo_path is distinct from old.flashing_photo_path
       or new.scopes is distinct from old.scopes then
      raise exception 'Only the cover photo may be changed on a job by this role';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_guard_cover_only_update
  before update on public.jobs
  for each row execute function private.guard_job_cover_only_update();

-- ===========================================================================
-- job_issues: installers may resolve/reopen issues too (the app still limits
-- description edits to the creator). Recreate the UPDATE policy with the
-- installer clause added.
-- ===========================================================================
drop policy if exists job_issues_update on public.job_issues;
create policy job_issues_update on public.job_issues
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) in ('operator', 'installer')
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
    or (select private.current_app_role()) in ('operator', 'installer')
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
-- job_documents table
-- ===========================================================================
create table public.job_documents (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  worker_id    uuid not null references public.workers (id) on delete cascade,
  kind         text not null check (kind in ('photo', 'pdf', 'text')),
  -- Required display title, typed at creation.
  title        text not null,
  -- The content of a 'text' document.
  body         text,
  -- Object path inside the job-documents bucket (photo/pdf kinds).
  storage_path text,
  created_at   timestamptz not null default now()
);

create index job_documents_job_id_idx on public.job_documents (job_id);

grant select, insert, update, delete on public.job_documents to authenticated;

alter table public.job_documents enable row level security;

-- Everyone sees a job's documents except Field Supers, who are scoped to
-- their own jobs (mirrors job_photos_select).
create policy job_documents_select on public.job_documents
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'field_super'
    or exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = job_documents.job_id
        and jfs.field_super_id = (select auth.uid())
    )
  );

-- Any non-installer may add documents to a job they can see, as themselves.
-- (Installers view documents; they don't create them.)
create policy job_documents_insert on public.job_documents
  for insert to authenticated
  with check (
    worker_id = (select auth.uid())
    and (select private.current_app_role()) <> 'installer'
    and (
      (select private.current_app_role()) <> 'field_super'
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_documents.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- The creator edits their own document; the Operator may edit anything.
create policy job_documents_update on public.job_documents
  for update to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
  )
  with check (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
  );

-- Creators delete their own documents; the Operator can clean up anything.
create policy job_documents_delete on public.job_documents
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
  );

-- ===========================================================================
-- Storage bucket. Public reads (documents render/open via plain public URLs —
-- paths contain unguessable uuids); images + PDFs allowed.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-documents',
  'job-documents',
  true,
  26214400, -- 25 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy job_documents_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-documents'
    and (select private.current_app_role()) <> 'installer'
  );

create policy job_documents_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-documents'
    and (
      owner_id = (select auth.uid()::text)
      or (select private.current_app_role()) = 'operator'
    )
  );

-- ===========================================================================
-- Realtime — documents another session adds stream into open sessions.
-- ===========================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_documents'
  ) then
    alter publication supabase_realtime add table public.job_documents;
  end if;
end $$;
