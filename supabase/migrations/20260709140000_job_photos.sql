-- Job photos (installer Pics feature).
--
-- Installers photograph their work on site. A photo always belongs to a parent
-- JOB (the jobsite) — that's where crews and the office browse them — and may
-- additionally reference the jobcard it was taken for (photos captured from a
-- jobcard's detail screen carry that link).
--
-- The image bytes live in the `job-photos` storage bucket (public reads, so the
-- app can render plain URLs); this table is the source of truth for which
-- photos exist, who took them, and their notes. Deleting a row does NOT delete
-- the storage object — the app removes both (see deleteJobPhoto in
-- integrations/supabase/data.ts).

-- ===========================================================================
-- Table
-- ===========================================================================
create table public.job_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  -- Set when the photo was taken from a jobcard's screen; survives the
  -- jobcard's deletion (the photo still documents the jobsite).
  jobcard_id   uuid references public.jobcards (id) on delete set null,
  worker_id    uuid not null references public.workers (id) on delete cascade,
  -- Object path inside the job-photos bucket: "<job_id>/<photo_id>.jpg".
  storage_path text not null,
  -- Installer-written caption, editable by the photo's owner.
  note         text,
  taken_at     timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index job_photos_job_id_idx on public.job_photos (job_id);

-- ===========================================================================
-- Grants + RLS
-- ===========================================================================
grant select, insert, update, delete on public.job_photos to authenticated;

alter table public.job_photos enable row level security;

-- Everyone sees a job's photos except Field Supers, who are scoped to their own
-- jobs (mirrors jobs_select).
create policy job_photos_select on public.job_photos
  for select to authenticated
  using (
    (select private.current_app_role()) <> 'field_super'
    or exists (
      select 1 from public.job_field_supers jfs
      where jfs.job_id = job_photos.job_id
        and jfs.field_super_id = (select auth.uid())
    )
  );

-- Anyone may add photos to a job they can see, but only as themselves.
create policy job_photos_insert on public.job_photos
  for insert to authenticated
  with check (
    worker_id = (select auth.uid())
    and (
      (select private.current_app_role()) <> 'field_super'
      or exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_photos.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- Only the photographer edits a photo (its note).
create policy job_photos_update on public.job_photos
  for update to authenticated
  using (worker_id = (select auth.uid()))
  with check (worker_id = (select auth.uid()));

-- Owners delete their own photos; Field Supers delete any photo they can see;
-- the Operator can clean up anything.
create policy job_photos_delete on public.job_photos
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
    or (
      (select private.current_app_role()) = 'field_super'
      and exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_photos.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- Storage bucket. Public reads (photos render via plain public URLs — paths
-- contain unguessable uuids); writes/deletes gated below.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  true,
  26214400, -- 25 MiB; the app compresses to ~1600px JPEG well under this
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy job_photos_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-photos');

create policy job_photos_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and (
      owner_id = (select auth.uid()::text)
      or (select private.current_app_role()) in ('field_super', 'operator')
    )
  );

-- ===========================================================================
-- Realtime — photos another crew member adds stream into open sessions.
-- ===========================================================================
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_photos'
  ) then
    alter publication supabase_realtime add table public.job_photos;
  end if;
end $$;
