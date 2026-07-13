-- Finance Manager role, part 1 of 2: the enum value + the labor budget column.
--
-- The Finance Manager owns money-facing work: reviewing timesheets before the
-- weekly QuickBooks Time push (taken over from the Operator), assigning each
-- job's QBT jobcode id, and tracking labor budgets per job.
--
-- Split across two migrations because a new enum value cannot be USED in the
-- same transaction that adds it — the policies/guards land in part 2
-- (20260712150500_finance_manager_policies.sql).
alter type public.app_role add value if not exists 'finance_manager';

-- Total labor budget assigned to a job, in dollars. Set by the Finance
-- Manager; the jobs tab compares it against wages paid out (the sum of
-- timesheet earnings on the job's jobcards).
alter table public.jobs
  add column if not exists labor_budget numeric;
