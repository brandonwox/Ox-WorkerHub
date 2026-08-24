import { Job } from '@/types';

/**
 * Whether `po` is already used by another job (archived jobs included — a
 * restore must not surface a collision). Case-insensitive and
 * whitespace-trimmed; blank POs never collide. Pass `excludeJobId` when
 * validating an edit so the job doesn't collide with itself.
 */
export function poTaken(
  po: string | undefined,
  jobs: Job[],
  excludeJobId?: string
): boolean {
  const p = po?.trim().toLowerCase();
  if (!p) return false;
  return jobs.some(
    (j) => j.id !== excludeJobId && j.po?.trim().toLowerCase() === p
  );
}

/** The standard warning shown when {@link poTaken} blocks a save. */
export const PO_TAKEN_MESSAGE = 'That PO is already used by another job.';
