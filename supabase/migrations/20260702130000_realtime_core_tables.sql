-- Realtime for the core collaborative tables.
--
-- The app opens one realtime channel over these tables (see
-- integrations/supabase/data.ts -> subscribeAllData) so a change one session
-- makes — e.g. a Field Super creating a jobcard — streams into every other
-- signed-in session's lists without a manual refresh. Previously only the
-- `notifications` table was published, so cross-session data changes were
-- invisible until the recipient reloaded the page.
--
-- Realtime still evaluates each table's SELECT RLS policy, so a session only
-- receives rows it is already allowed to read. Idempotent: skips any table that
-- is already a member of the publication so a re-run (or a table added to the
-- publication by an earlier migration) is a no-op.

do $$
declare
  t text;
begin
  foreach t in array array[
    'workers',
    'jobs',
    'job_field_supers',
    'jobcards',
    'crews',
    'crew_members',
    'daily_crews',
    'daily_crew_members',
    'schedule_assignments',
    'timesheets'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
