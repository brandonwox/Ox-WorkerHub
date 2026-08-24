-- Daily crews are no longer pinned to a single date. They are ad-hoc crews
-- that override a member's permanent crew on ANY day they actually have work
-- scheduled (resolved in the app from schedule_assignments). The date column
-- (and its data) is gone entirely — the app neither reads nor writes it.
alter table public.daily_crews drop column if exists date;
