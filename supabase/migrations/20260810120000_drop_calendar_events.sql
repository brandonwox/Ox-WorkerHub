-- Remove the calendar Events feature (decision: events are gone entirely —
-- the "+ Event" day notes, their popups, and the installer-agenda pins).
-- Work requests and schedule_assignments are untouched.
--
-- Dropping the table also drops its policies, index, and grants; the
-- publication membership must be removed first or the drop leaves a dangling
-- publication entry on some Postgres versions.

alter publication supabase_realtime drop table public.calendar_events;

drop table public.calendar_events;
