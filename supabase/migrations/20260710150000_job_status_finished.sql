-- Rename the job status 'Archived' to 'Finished'.
-- (Job status only — jobcard statuses are a separate column and are untouched.)

alter table public.jobs drop constraint jobs_status_check;

update public.jobs set status = 'Finished' where status = 'Archived';

alter table public.jobs
  add constraint jobs_status_check check (status in ('Active', 'Finished'));
