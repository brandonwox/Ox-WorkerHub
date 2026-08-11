import { Job } from '@/types';

/**
 * Preset answers to "what are this job's sub-jobs called?" — chosen (or
 * replaced with a custom term) when "This job has Sub-Jobs" is enabled.
 */
export const SUB_JOB_TYPE_PRESETS = ['Lots', 'Phases', 'Bldgs'] as const;

/**
 * The singular form of a sub-job type, used as the name prefix when creating
 * a sub-job ("Lots" → "Lot 159"). Presets drop their trailing "s"; custom
 * terms are used as typed.
 */
export function subJobTypeSingular(type: string | undefined): string {
  const t = type?.trim() ?? '';
  return (SUB_JOB_TYPE_PRESETS as readonly string[]).includes(t)
    ? t.slice(0, -1)
    : t;
}

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
 * context (work request headers, the installer jobs tab, the finance manager list,
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
 * jobId (e.g. a work request's parent reference).
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
