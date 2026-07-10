-- Jobcard tasks become check-off items (installer task list).
--
-- Tasks were a plain text[] of descriptions. Installers now check each task
-- off from their phone and raise issues per task, so every task needs a stable
-- identity and completion state:
--   tasks jsonb = [{ "id": uuid, "text": ..., "done": bool,
--                    "doneById"?: uuid, "doneAt"?: timestamptz }, ...]
-- The id survives Field Super text edits, so check-offs and per-task issues
-- never mis-link when the task list is edited.

-- ===========================================================================
-- Column conversion: text[] -> jsonb objects (each gets a generated id).
-- A helper function is required because ALTER ... USING cannot contain a
-- subquery; dropped right after.
-- ===========================================================================
create or replace function private.jobcard_tasks_to_jsonb(tasks text[])
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', gen_random_uuid(), 'text', t, 'done', false)
      )
      from unnest(tasks) as t
    ),
    '[]'::jsonb
  );
$$;

alter table public.jobcards alter column tasks drop default;
alter table public.jobcards
  alter column tasks type jsonb
  using private.jobcard_tasks_to_jsonb(tasks);
alter table public.jobcards alter column tasks set default '[]'::jsonb;

drop function private.jobcard_tasks_to_jsonb(text[]);

-- ===========================================================================
-- Issues link to the task they were raised for. No FK — tasks live inside the
-- jobcard's jsonb. An issue whose task disappears just renders un-linked.
-- ===========================================================================
alter table public.job_issues add column if not exists task_id uuid;

-- ===========================================================================
-- Installer guard update. Installers may now also toggle task done-flags, but
-- still not edit task text (or add/remove/reorder tasks): the guard compares
-- the task arrays with the completion fields stripped.
-- ===========================================================================
create or replace function private.jobcard_tasks_content(tasks jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg((elem - 'done' - 'doneById' - 'doneAt') order by ord)
      from jsonb_array_elements(coalesce(tasks, '[]'::jsonb))
        with ordinality as t(elem, ord)
    ),
    '[]'::jsonb
  );
$$;

create or replace function private.guard_jobcard_installer_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'installer' then
    if new.title is distinct from old.title
       or new.job_id is distinct from old.job_id
       or new.address is distinct from old.address
       or new.date is distinct from old.date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.priority is distinct from old.priority
       or new.priority_order is distinct from old.priority_order
       or new.scopes is distinct from old.scopes
       or private.jobcard_tasks_content(new.tasks)
          is distinct from private.jobcard_tasks_content(old.tasks)
       or new.readiness is distinct from old.readiness
       or new.flashing_material is distinct from old.flashing_material
       or new.materials is distinct from old.materials
       or new.notes is distinct from old.notes
       or new.scope_of_work is distinct from old.scope_of_work
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status, field notes, and task check-offs on a jobcard';
    end if;
  end if;
  return new;
end;
$$;
