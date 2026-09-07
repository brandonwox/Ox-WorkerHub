-- Job TO-DOs: a Field-Super-only check-off list on every job (parent or
-- sub-job), mirroring work_requests.tasks — the same jsonb shape
-- [{ "id": uuid, "text": ..., "done": bool, "doneById"?: uuid, "doneAt"?: iso }]
-- so photos (job_photos.task_id) and issues (job_issues.task_id) link to a
-- TO-DO by id exactly the way they link to a work request task.
--
-- Who may write it: Field Supers and Schedulers already may (their guard,
-- private.guard_job_field_super_update, is a blocklist of office/finance
-- columns — 20260824180000). Installers never see the list, and their guard
-- below pins the column too so a stray client can't edit it. The finance
-- guard (20260813120000) is left as is — a Finance Manager's jobs UI has no
-- TO-DOs; tighten it if that ever changes.

alter table public.jobs
  add column if not exists todos jsonb not null default '[]'::jsonb;

-- ===========================================================================
-- Installers: cover photo, flashing material/photo, and done counts only —
-- previous definition 20260824180000_scheduler_full_job_edit.sql, plus todos.
-- ===========================================================================
create or replace function private.guard_job_cover_only_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'installer' then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id
       or new.po is distinct from old.po
       or new.builder is distinct from old.builder
       or new.scopes is distinct from old.scopes
       or new.labor_budget is distinct from old.labor_budget
       or new.parent_job_id is distinct from old.parent_job_id
       or new.has_sub_jobs is distinct from old.has_sub_jobs
       or new.sub_job_type is distinct from old.sub_job_type
       or new.archived_at is distinct from old.archived_at
       or new.todos is distinct from old.todos
       or new.window_count_total is distinct from old.window_count_total
       or new.sgd_count_total is distinct from old.sgd_count_total
       or new.mirror_count_total is distinct from old.mirror_count_total
       or new.shower_count_total is distinct from old.shower_count_total
       or new.swing_door_count_total is distinct from old.swing_door_count_total
       or new.screen_count_total is distinct from old.screen_count_total
       or new.igu_count_total is distinct from old.igu_count_total
       or new.window_layout_not_needed is distinct from old.window_layout_not_needed
       or new.mirror_layout_not_needed is distinct from old.mirror_layout_not_needed
       or new.shower_layout_not_needed is distinct from old.shower_layout_not_needed then
      raise exception 'Only the cover photo and flashing material may be changed on a job by this role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
