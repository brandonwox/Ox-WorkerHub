-- Unified scopes + counts for every scope + videos in the photo taker.
--
-- 1) SCOPES: the selectable set is now Windows, Mirrors, Showers, Swing Doors,
--    Screens, IGU's, Storefront, Service — the same list everywhere (jobs,
--    sub-jobs, work requests; no request-only scopes). Legacy
--    'Showerglass Door' values are renamed to 'Showers' (scopes are plain
--    text[], so this is a data fix, not a schema change).
--
-- 2) COUNTS: done/total pairs now exist for every counted scope — Shower,
--    Swing Door, Screen, and IGU counts join the existing Window/SGD/Mirror
--    ones. Same write rules: totals are office-set (Operator / Field Supers),
--    installers update only the done numbers, schedulers and the finance
--    manager touch neither.
--
-- 3) VIDEOS: the in-app photo taker can record videos. job_photos rows carry
--    is_video (uploads are .mp4) and sgd_video (the taker confirmed the video
--    shows SGD work — the "Were any SGD videos taken?" popup on leaving the
--    camera of a Windows-scope work request; drives the Pictures sections'
--    "SGD Videos" filter). The job-photos bucket must accept video mime types.

-- ===========================================================================
-- 1) Scope rename: 'Showerglass Door' → 'Showers' in both scope arrays.
-- ===========================================================================
update public.jobs
  set scopes = array_replace(scopes, 'Showerglass Door', 'Showers')
  where scopes @> array['Showerglass Door'];

update public.work_requests
  set scopes = array_replace(scopes, 'Showerglass Door', 'Showers')
  where scopes @> array['Showerglass Door'];

-- ===========================================================================
-- 2) New count columns.
-- ===========================================================================
alter table public.jobs
  add column if not exists shower_count_done integer,
  add column if not exists shower_count_total integer,
  add column if not exists swing_door_count_done integer,
  add column if not exists swing_door_count_total integer,
  add column if not exists screen_count_done integer,
  add column if not exists screen_count_total integer,
  add column if not exists igu_count_done integer,
  add column if not exists igu_count_total integer;

-- ===========================================================================
-- Installers: cover photo, flashing material, and the DONE counts. Schedulers:
-- cover photo + has_sub_jobs. Totals stay blocked for both. (Latest previous
-- definition: 20260718120000_layout_plan_documents.sql — this adds the four
-- new pairs to the same blocklists.)
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
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_total is distinct from old.igu_count_total
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
-- Finance managers: still QBT jobcode + labor budget + flashing only — pin
-- the new count columns too. (Latest previous definition: 20260718120000.)
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
       or new.shower_count_done is distinct from old.shower_count_done
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_done is distinct from old.swing_door_count_done
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_done is distinct from old.screen_count_done
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_done is distinct from old.igu_count_done
       or new.igu_count_total is distinct from old.igu_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed then
      raise exception 'Finance managers may only edit the QBT jobcode, labor budget, and flashing material on a job'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 3) Video columns on job_photos + video mime types in the storage bucket.
--    The update RLS policy already limits edits (note, and now sgd_video) to
--    the photo's owner — no policy change needed.
-- ===========================================================================
alter table public.job_photos
  add column if not exists is_video boolean not null default false,
  add column if not exists sgd_video boolean not null default false;

update storage.buckets
  set allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime'
  ],
      -- 200 MiB: videos can't be recompressed on device the way photos are.
      -- In-camera recordings are capped at 1080p / 2 minutes (well under
      -- this); library-picked videos are size-checked in the app before
      -- queueing.
      file_size_limit = 209715200
  where id = 'job-photos';
