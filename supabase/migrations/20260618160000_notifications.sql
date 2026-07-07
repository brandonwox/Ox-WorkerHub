-- Notifications — targeted pings to specific workers.
--
-- A notification belongs to exactly one recipient (a worker). Whatever action
-- warrants a ping inserts the row (e.g. a field_super marking a jobcard
-- "Now" inserts one notification per scheduler); the recipient's session picks
-- it up over Supabase realtime and surfaces a toast + unread badge.
--
-- Security: like the other tables, this is GRANTed to `authenticated` and then
-- locked down with RLS. A worker may only read/update/delete their OWN rows; any
-- authenticated worker may INSERT a row for another worker (the app, not RLS,
-- decides who the recipients are).

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.workers (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text not null default '',
  data         jsonb not null default '{}'::jsonb,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- The recipient's panel reads their newest-first; index that access path.
create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

-- New tables are not auto-exposed to the Data API; grant then protect with RLS.
grant select, insert, update, delete on public.notifications to authenticated;

alter table public.notifications enable row level security;

-- A worker sees and manages only their own notifications.
create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- Any authenticated worker may create a notification targeted at another worker
-- (e.g. a Field Super pinging the scheduler about a "Now" jobcard). The app owns the
-- recipient logic; RLS just requires a logged-in author.
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (true);

-- Deliver INSERTs to the recipient's session in real time. Realtime evaluates
-- the SELECT policy above, so a worker only ever receives their own rows.
alter publication supabase_realtime add table public.notifications;
