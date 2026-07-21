-- Calendar Events — simple scheduler-authored day notes.
--
-- An Event is a title + optional description pinned to a day ("Brandon off
-- all day"). On the calendars it renders like a work request chip, but it has
-- no crew, no tasks, and no status — its popup shows only date, title, and
-- description. Events share the per-day ordering space with work requests
-- (priority_order), so they drag-and-drop and reorder just like requests.
--
-- Security: everyone signed in may READ events (installers see them on their
-- agenda; field supers on their calendar). Only schedulers create, edit,
-- delete, or move them.

create table public.calendar_events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text not null default '',
  -- The day the event sits on (yyyy-MM-dd).
  date           date not null,
  -- Intra-day sort key, shared with work_requests.priority_order.
  priority_order integer not null default 0,
  created_by     uuid references public.workers (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Day cells read by date; index that access path.
create index calendar_events_date_idx on public.calendar_events (date);

-- New tables are not auto-exposed to the Data API; grant then protect via RLS.
grant select, insert, update, delete on public.calendar_events to authenticated;

alter table public.calendar_events enable row level security;

create policy calendar_events_select on public.calendar_events
  for select to authenticated using (true);

create policy calendar_events_write on public.calendar_events
  for all to authenticated
  using ((select private.current_app_role()) = 'scheduler')
  with check ((select private.current_app_role()) = 'scheduler');

-- Stream changes into every open session (same as the other core tables).
alter publication supabase_realtime add table public.calendar_events;
