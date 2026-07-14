import { Job } from '@/types';

/**
 * The job's parent when it is a sub-job, else undefined.
 */
export function parentJobOf(
  job: Job | undefined,
  jobs: Job[]
): Job | undefined {
  if (!job?.parentJobId) return undefined;
  return jobs.find((j) => j.id === job.parentJobId);
}

/**
 * A job's display name with the parent conjoined for sub-jobs:
 * "Vista Homes Lot 2". Sub-job names are STORED without the parent's name;
 * use this everywhere a sub-job must be identifiable outside its parent's
 * context (jobcard headers, the installer jobs tab, the finance manager list,
 * job pickers). Inside the parent's own Sub-Jobs section, render `job.name`
 * plain instead.
 */
export function jobDisplayName(job: Job | undefined, jobs: Job[]): string {
  if (!job) return '';
  const parent = parentJobOf(job, jobs);
  return parent ? `${parent.name} ${job.name}` : job.name;
}

/**
 * {@link jobDisplayName} looked up by id — for call sites that only hold a
 * jobId (e.g. a jobcard's parent reference).
 */
export function jobDisplayNameById(
  jobId: string | undefined,
  jobs: Job[]
): string {
  if (!jobId) return '';
  return jobDisplayName(
    jobs.find((j) => j.id === jobId),
    jobs
  );
}
