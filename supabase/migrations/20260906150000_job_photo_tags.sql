-- Custom photo tags: free-text labels on a job photo ("before", "damage", …),
-- several per photo, picked or typed in the camera at capture time and edited
-- later from the photo viewer. Suggestions are company-wide — every tag ever
-- used on any photo — so there is no tag registry; the Pictures filter on the
-- job pages offers the tags present on that job's photos.
--
-- Who may tag: ANYONE (decision 2026-09-06). The photographer already owns
-- their row; other workers may update a photo too, but only its tags — the
-- guard trigger below rejects any other column change from a non-owner. The
-- update policy therefore opens to every authenticated user (SELECT visibility
-- still decides which rows they can reach at all).

alter table public.job_photos
  add column if not exists tags text[] not null default '{}';

-- Non-owners: tags only.
create or replace function private.guard_job_photo_non_owner_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.worker_id is distinct from (select auth.uid()) then
    if new.job_id is distinct from old.job_id
       or new.work_request_id is distinct from old.work_request_id
       or new.issue_id is distinct from old.issue_id
       or new.task_id is distinct from old.task_id
       or new.worker_id is distinct from old.worker_id
       or new.storage_path is distinct from old.storage_path
       or new.note is distinct from old.note
       or new.taken_at is distinct from old.taken_at
       or new.is_video is distinct from old.is_video
       or new.sgd_video is distinct from old.sgd_video
       or new.photo_type is distinct from old.photo_type then
      raise exception 'Only the photographer may change this photo (others may edit its tags)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_photos_guard_non_owner_update on public.job_photos;
create trigger job_photos_guard_non_owner_update
  before update on public.job_photos
  for each row execute function private.guard_job_photo_non_owner_update();

-- Previous definition (20260709140000): owner-only. Now any authenticated
-- user may update a row they can see; the trigger narrows non-owners to tags.
drop policy if exists job_photos_update on public.job_photos;
create policy job_photos_update on public.job_photos
  for update to authenticated
  using (true)
  with check (true);
