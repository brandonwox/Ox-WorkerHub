-- Priority becomes a date range: the Field Super picks "Now", "This week",
-- "Next week", or manual dates, and the card carries the resulting start→end
-- window. When the end date arrives and the card isn't finished, the app
-- escalates the card's priority to 'Now' (and pings the schedulers).
-- Label-only legacy cards leave both columns NULL and behave as before.
alter table public.jobcards
  add column if not exists priority_start_date date,
  add column if not exists priority_end_date date;
