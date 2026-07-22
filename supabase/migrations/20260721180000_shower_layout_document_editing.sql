-- Shower Layout Plans + document editing/deletion + document upload fix.
--
-- 1) 'shower_layout' joins the doc_type tags and jobs get
--    shower_layout_not_needed — Showers-scoped jobs now run the same
--    layout-plan warning/assignment flow as Windows and Mirrors.
--
-- 2) Documents become editable (title/body/type) and deletable by the roles
--    that manage them: the creator, the Operator, and Field Supers scoped to
--    the document's job (delete previously stopped at creator/Operator).
--
-- 3) Root-cause fix for "Document upload failed — check your signal and
--    retry": the app uploads document files with upsert:true, which storage
--    executes as INSERT ... ON CONFLICT DO UPDATE. Postgres needs INSERT,
--    UPDATE *and* SELECT policies on storage.objects for that statement even
--    when no conflicting row exists. The job-documents bucket only had
--    INSERT + DELETE — the exact bug fixed for job-photos on 2026-07-10
--    (20260710210000 / 20260710230000), which never reached this bucket.

-- ===========================================================================
-- Columns: the new doc_type value + the jobs "not necessary" flag.
-- ===========================================================================
alter table public.job_documents
  drop constraint if exists job_documents_doc_type_check;
alter table public.job_documents
  add constraint job_documents_doc_type_check
    check (doc_type in (
      'window_layout', 'mirror_layout', 'shower_layout', 'flashing_example'
    ));

alter table public.jobs
  add column if not exists shower_layout_not_needed boolean not null default false;

-- ===========================================================================
-- job_documents DELETE widens to match UPDATE: creator, Operator, or a Field
-- Super scoped to the document's job.
-- ===========================================================================
drop policy if exists job_documents_delete on public.job_documents;
create policy job_documents_delete on public.job_documents
  for delete to authenticated
  using (
    worker_id = (select auth.uid())
    or (select private.current_app_role()) = 'operator'
    or (
      (select private.current_app_role()) = 'field_super'
      and exists (
        select 1 from public.job_field_supers jfs
        where jfs.job_id = job_documents.job_id
          and jfs.field_super_id = (select auth.uid())
      )
    )
  );

-- ===========================================================================
-- job-documents storage: SELECT + UPDATE policies so upsert uploads pass RLS
-- (mirrors the verified job-photos fix), and DELETE widens to any non-installer
-- so a Field Super deleting another's document doesn't strand the file (the
-- row policy above is the real gate; objects are cleanup).
-- ===========================================================================
create policy job_documents_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'job-documents');

create policy job_documents_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'job-documents')
  with check (bucket_id = 'job-documents');

drop policy if exists job_documents_objects_delete on storage.objects;
create policy job_documents_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-documents'
    and (select private.current_app_role()) <> 'installer'
  );

-- ===========================================================================
-- Installers/Schedulers job guard: shower_layout_not_needed joins the other
-- layout flags on the blocklist (office-only). Latest previous definition:
-- 20260721120000_job_po.sql — this adds only the new column.
-- ===========================================================================
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
       or new.po is distinct from old.po
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_total is distinct from old.igu_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
       or new.shower_layout_not_needed is distinct from old.shower_layout_not_needed
       or (
         private.current_app_role() = 'installer'
         and new.has_sub_jobs is distinct from old.has_sub_jobs
       )
       or (
         private.current_app_role() = 'scheduler'
         and (
           new.window_count_done is distinct from old.window_count_done
           or new.sgd_count_done is distinct from old.sgd_count_done
           or new.mirror_count_done is distinct from old.mirror_count_done
           or new.shower_count_done is distinct from old.shower_count_done
           or new.swing_door_count_done is distinct from old.swing_door_count_done
           or new.screen_count_done is distinct from old.screen_count_done
           or new.igu_count_done is distinct from old.igu_count_done
         )
       ) then
      raise exception 'Only the cover photo and flashing material may be changed on a job by this role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- Finance managers: pin shower_layout_not_needed too. Latest previous
-- definition: 20260721120000_job_po.sql.
-- ===========================================================================
create or replace function private.guard_job_finance_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'finance_manager' then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.po is distinct from old.po
       or new.scopes is distinct from old.scopes
       or new.cover_photo_id is distinct from old.cover_photo_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_done is distinct from old.window_count_done
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_done is distinct from old.sgd_count_done
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_done is distinct from old.mirror_count_done
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.shower_count_done is distinct from old.shower_count_done
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_done is distinct from old.swing_door_count_done
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_done is distinct from old.screen_count_done
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_done is distinct from old.igu_count_done
       or new.igu_count_total is distinct from old.igu_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
       or new.shower_layout_not_needed is distinct from old.shower_layout_not_needed then
      raise exception 'Finance managers may only edit the QBT jobcode, labor budget, and flashing material on a job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
