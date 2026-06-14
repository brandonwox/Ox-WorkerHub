-- Ox WorkerHub — initial schema, role helpers, and RLS.
--
-- Foundation for Step 7 (Backend Persistence). Mirrors the in-memory store
-- collections (see src/store/useAppStore.ts) as Postgres tables.
--
-- Security notes:
--  * New public tables are NOT auto-exposed to the Data API (Supabase change
--    2026-04-28), so every table is explicitly GRANTed to `authenticated` and
--    then protected by RLS below. `anon` gets no access — the app requires login.
--  * The role helper is SECURITY DEFINER and lives in a non-exposed `private`
--    schema with an auth.uid() check, never in `public`.

-- ===========================================================================
-- Enums
-- ===========================================================================
create type public.app_role as enum
  ('installer', 'scheduler', 'operator', 'project_manager');

-- ===========================================================================
-- Private schema — helpers that bypass RLS without being reachable via the API.
-- ===========================================================================
create schema if not exists private;

-- ===========================================================================
-- Tables
-- ===========================================================================

-- A worker IS an auth user (1:1). Invited-but-unaccepted workers still have an
-- auth.users row (created by inviteUserByEmail), so this FK holds for them too.
create table public.workers (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null unique,
  phone       text not null default '',
  role        public.app_role not null default 'installer',
  trade_role  text not null default '',
  hourly_rate numeric not null default 0,
  status      text not null default 'invited' check (status in ('invited', 'active')),
  created_at  timestamptz not null default now()
);

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  location          text not null default '',
  status            text not null default 'Active' check (status in ('Active', 'Archived')),
  qbt_jobcode_id    text,
  flashing_material text,
  created_at        timestamptz not null default now()
);

create table public.jobcards (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid references public.jobs (id) on delete cascade,
  title             text not null,
  address           text not null default '',
  date              date not null,
  start_time        timestamptz,
  end_time          timestamptz,
  status            text not null default 'Upcoming' check (status in ('Upcoming', 'In Progress', 'Finished')),
  priority          text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  priority_order    integer not null default 0,
  flashing_material text,
  materials         text,
  scope_of_work     text,
  field_notes       text,
  details           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create table public.crews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id      uuid not null references public.crews (id) on delete cascade,
  installer_id uuid not null references public.workers (id) on delete cascade,
  primary key (crew_id, installer_id)
);

create table public.daily_crews (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.daily_crew_members (
  daily_crew_id uuid not null references public.daily_crews (id) on delete cascade,
  installer_id  uuid not null references public.workers (id) on delete cascade,
  primary key (daily_crew_id, installer_id)
);

create table public.schedule_assignments (
  id         uuid primary key default gen_random_uuid(),
  jobcard_id uuid not null references public.jobcards (id) on delete cascade,
  crew_id    uuid not null, -- references a crew OR a daily_crew (resolved in app)
  date       date not null,
  created_at timestamptz not null default now(),
  unique (jobcard_id, crew_id, date)
);

create table public.timesheets (
  id                  uuid primary key default gen_random_uuid(),
  worker_id           uuid not null references public.workers (id) on delete cascade,
  date                date not null,
  jobcard_id          uuid references public.jobcards (id) on delete set null,
  custom_project_name text,
  start_time          timestamptz not null,
  end_time            timestamptz not null,
  total_hours         numeric not null default 0,
  earned_amount       numeric not null default 0,
  send_status         text not null default 'unsent' check (send_status in ('unsent', 'sent', 'failed')),
  created_at          timestamptz not null default now()
);

-- ===========================================================================
-- Role helper (SECURITY DEFINER, private schema). Reads workers bypassing RLS
-- to avoid policy recursion. Never trust user_metadata for authorization.
-- ===========================================================================
create or replace function private.current_app_role()
returns public.app_role
language sql
security definer
set search_path = ''
stable
as $$
  select role from public.workers where id = (select auth.uid());
$$;

revoke all on function private.current_app_role() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_app_role() to authenticated;

-- ===========================================================================
-- Integrity triggers (defense in depth; the UI enforces the same rules).
-- ===========================================================================

-- Crew members must be installers.
create or replace function private.assert_installer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workers w
    where w.id = new.installer_id and w.role = 'installer'
  ) then
    raise exception 'Crew members must have role installer (worker % does not)', new.installer_id;
  end if;
  return new;
end;
$$;

create trigger crew_members_installer_only
  before insert or update on public.crew_members
  for each row execute function private.assert_installer();

create trigger daily_crew_members_installer_only
  before insert or update on public.daily_crew_members
  for each row execute function private.assert_installer();

-- Only an operator may change a worker's role or pay rate.
create or replace function private.guard_worker_role_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() is distinct from 'operator' then
    if new.role is distinct from old.role
       or new.hourly_rate is distinct from old.hourly_rate then
      raise exception 'Only an operator can change a worker''s role or pay rate';
    end if;
  end if;
  return new;
end;
$$;

create trigger workers_guard_role_rate
  before update on public.workers
  for each row execute function private.guard_worker_role_rate();

-- A project manager may edit only flashing_material on a job.
create or replace function private.guard_job_pm_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_app_role() = 'project_manager' then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.status is distinct from old.status
       or new.qbt_jobcode_id is distinct from old.qbt_jobcode_id then
      raise exception 'Project managers may only edit flashing_material on a job';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_guard_pm_update
  before update on public.jobs
  for each row execute function private.guard_job_pm_update();

-- An installer may change only status / field_notes on a jobcard.
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
       or new.flashing_material is distinct from old.flashing_material
       or new.materials is distinct from old.materials
       or new.scope_of_work is distinct from old.scope_of_work
       or new.details is distinct from old.details then
      raise exception 'Installers may only update status and field_notes on a jobcard';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobcards_guard_installer_update
  before update on public.jobcards
  for each row execute function private.guard_jobcard_installer_update();

-- ===========================================================================
-- Grants — expose tables to the authenticated role (new tables are not
-- auto-exposed). RLS below restricts which rows each role can touch.
-- ===========================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.workers enable row level security;
alter table public.jobs enable row level security;
alter table public.jobcards enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.daily_crews enable row level security;
alter table public.daily_crew_members enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.timesheets enable row level security;

-- --- workers --------------------------------------------------------------
-- NOTE: all authenticated can read the roster (names/roles drive pickers).
-- hourly_rate is column-readable here; the UI hides it from non-operators. A
-- later refinement can move pay behind a view/column-privilege for true
-- column-level secrecy.
create policy workers_select on public.workers
  for select to authenticated using (true);
create policy workers_insert on public.workers
  for insert to authenticated
  with check ((select private.current_app_role()) = 'operator');
create policy workers_update_operator on public.workers
  for update to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');
create policy workers_update_self on public.workers
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid())); -- role/rate changes blocked by trigger
create policy workers_delete on public.workers
  for delete to authenticated
  using ((select private.current_app_role()) = 'operator');

-- --- jobs -----------------------------------------------------------------
create policy jobs_select on public.jobs
  for select to authenticated using (true);
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check ((select private.current_app_role()) = 'operator');
create policy jobs_update_operator on public.jobs
  for update to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');
create policy jobs_update_pm on public.jobs
  for update to authenticated
  using ((select private.current_app_role()) = 'project_manager')
  with check ((select private.current_app_role()) = 'project_manager'); -- columns limited by trigger
create policy jobs_delete on public.jobs
  for delete to authenticated
  using ((select private.current_app_role()) = 'operator');

-- --- jobcards -------------------------------------------------------------
create policy jobcards_select on public.jobcards
  for select to authenticated using (true);
create policy jobcards_insert on public.jobcards
  for insert to authenticated
  with check ((select private.current_app_role()) = 'project_manager');
create policy jobcards_update_pm on public.jobcards
  for update to authenticated
  using ((select private.current_app_role()) = 'project_manager')
  with check ((select private.current_app_role()) = 'project_manager');
create policy jobcards_update_installer on public.jobcards
  for update to authenticated
  using ((select private.current_app_role()) = 'installer')
  with check ((select private.current_app_role()) = 'installer'); -- columns limited by trigger
create policy jobcards_delete on public.jobcards
  for delete to authenticated
  using ((select private.current_app_role()) = 'project_manager');

-- --- crews / daily crews / members / assignments (scheduler writes) --------
create policy crews_read on public.crews
  for select to authenticated using (true);
create policy crews_write on public.crews
  for all to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

create policy crew_members_read on public.crew_members
  for select to authenticated using (true);
create policy crew_members_write on public.crew_members
  for all to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

create policy daily_crews_read on public.daily_crews
  for select to authenticated using (true);
create policy daily_crews_write on public.daily_crews
  for all to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

create policy daily_crew_members_read on public.daily_crew_members
  for select to authenticated using (true);
create policy daily_crew_members_write on public.daily_crew_members
  for all to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

create policy schedule_assignments_read on public.schedule_assignments
  for select to authenticated using (true);
create policy schedule_assignments_write on public.schedule_assignments
  for all to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

-- --- timesheets (own rows; operator sees/edits all) ------------------------
create policy timesheets_select on public.timesheets
  for select to authenticated
  using (worker_id = (select auth.uid()) or (select private.current_app_role()) = 'operator');
create policy timesheets_insert on public.timesheets
  for insert to authenticated
  with check (worker_id = (select auth.uid()));
create policy timesheets_update on public.timesheets
  for update to authenticated
  using (worker_id = (select auth.uid()) or (select private.current_app_role()) = 'operator')
  with check (worker_id = (select auth.uid()) or (select private.current_app_role()) = 'operator');
create policy timesheets_delete on public.timesheets
  for delete to authenticated
  using (worker_id = (select auth.uid()) or (select private.current_app_role()) = 'operator');
