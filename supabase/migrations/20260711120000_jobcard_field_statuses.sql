-- Jobcard statuses become field-report values.
--
-- The original Upcoming / In Progress / Finished set is replaced by what crews
-- actually report from the field: Untouched (default), False Start,
-- No Progress, Made Progress, Finished. Existing rows are mapped onto the
-- closest new value.

alter table public.jobcards drop constraint if exists jobcards_status_check;

update public.jobcards set status = 'Untouched'     where status = 'Upcoming';
update public.jobcards set status = 'Made Progress' where status = 'In Progress';
-- 'Finished' carries over unchanged.

alter table public.jobcards
  add constraint jobcards_status_check
  check (status in ('Untouched', 'False Start', 'No Progress', 'Made Progress', 'Finished'));

alter table public.jobcards alter column status set default 'Untouched';
