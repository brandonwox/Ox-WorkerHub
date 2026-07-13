-- Per-task photo linkage.
--
-- Installers must take at least one photo of a task before they can check it
-- off. Photos captured from a task's camera button carry that task's id here
-- (tasks are embedded records inside jobcards.tasks, so this is a loose
-- reference like job_issues.task_id — no FK). Photos keep their job/jobcard
-- links as before; task photos still show on the jobcard's photo grid.

alter table public.job_photos add column if not exists task_id uuid;
