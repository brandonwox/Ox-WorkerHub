-- Layout-plan documents (Window / Mirror Layout Plans, Window Flashing
-- Example).
--
-- 1) job_documents.doc_type — an optional type tag on a document. Typed
--    documents display the type label next to their title so installers can
--    identify e.g. every "Window Layout Plans" sheet at a glance.
--
-- 2) jobs.window_layout_not_needed / mirror_layout_not_needed — the Field
--    Super's "layout plans not necessary" choice. A Windows-scoped job with
--    neither this flag nor a 'window_layout' document shows the Field Super a
--    warning ("The installers need an image of the window layout.") with an
--    assignment flow; Mirrors-scoped jobs mirror that.
--
-- 3) job_documents UPDATE policy widens so a Field Super can retag an
--    EXISTING document on their job ("Choose from Job documents") that
--    someone else created.
--
-- 4) The jobs column guards are redefined to pin the two new columns to
--    office roles (operators/field supers). NOTE: this also RESTORES the
--    20260715 semantics (flashing material/photo editable by every role,
--    errcode 42501) that 20260717120000_job_scope_counts.sql accidentally
--    reverted — it was authored against the older 20260713 definitions.

-- ===========================================================================
-- Columns
-- ===========================================================================
alter table public.job_documents
  add column if not exists doc_type text
    check (doc_type in ('window_layout', 'mirror_layout', 'flashing_example'));

alter table public.jobs
  add column if not exists window_layout_not_needed boolean not null default false,
  add column if not exists mirror_layout_not_needed boolean not null default false;

-- ===========================================================================
-- job_documents UPDATE: the creator, the Operator — and now a Field Super
-- scoped to the document's job (they assign layout plans to existing docs).
-- ===========================================================================
drop policy if exists job_documents_update on public.job_documents;
create policy job_documents_update on public.job_documents
  for update to authenticated
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
  )
  with check (
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
-- Installers: cover photo + flashing material/photo + the three DONE counts.
-- Schedulers: those (minus done counts) + has_sub_jobs. The layout-not-needed
-- flags stay office-only. (Merges 20260715 — flashing open to all roles,
-- errcode 42501 — with 20260717's count columns.)
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
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
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
-- Finance managers: QBT jobcode + labor budget + flashing material/photo,
-- nothing else — pin the layout-not-needed flags too. (Same 20260715 +
-- 20260717 merge as above.)
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
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed then
      raise exception 'Finance managers may only edit the QBT jobcode, labor budget, and flashing material on a job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
