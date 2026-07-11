import { Job } from '@/types';

/**
 * Whether a job covers window work — drives every Window Opening Flashing
 * Material surface (job pages, jobcard creation/details). Jobs with no scopes
 * recorded (legacy rows, or "not narrowed yet") keep the old behavior and
 * allow windows; only an explicit scope set WITHOUT 'Windows' hides flashing.
 */
export function jobAllowsWindows(job: Job | undefined): boolean {
  if (!job?.scopes || job.scopes.length === 0) return true;
  return job.scopes.includes('Windows');
}
