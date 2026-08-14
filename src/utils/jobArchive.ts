import { Job, WorkRequest } from '@/types';
import { workRequestJobIds } from '@/utils/workRequestJobs';

/**
 * Archive helpers. "Deleting" a job archives it (jobs.archived_at) instead of
 * destroying it: archived jobs and their work requests disappear from every
 * active surface and live in the jobs pages' Archived section, where they can
 * be restored or permanently deleted. Sub-jobs archive with their parent.
 */

export function isJobArchived(job: Job | undefined): boolean {
  return !!job?.archivedAt;
}

/** The jobs that belong on active surfaces (lists, pickers, scopes). */
export function activeJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => !j.archivedAt);
}

/** Archived jobs, most recently archived first — the Archived section. */
export function archivedJobs(jobs: Job[]): Job[] {
  return jobs
    .filter((j) => !!j.archivedAt)
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));
}

/**
 * Whether a work request belongs to an archived job — linked to at least one
 * job and every linked job is archived (families archive together, so one
 * archived link means all of them in practice). Standalone cards are never
 * archived.
 */
export function isWorkRequestArchived(
  card: WorkRequest,
  jobs: Job[]
): boolean {
  const linked = workRequestJobIds(card);
  if (linked.length === 0) return false;
  return linked.every((id) => {
    const job = jobs.find((j) => j.id === id);
    return job != null && !!job.archivedAt;
  });
}

/** The work requests that belong on active surfaces. */
export function activeWorkRequests(
  cards: WorkRequest[],
  jobs: Job[]
): WorkRequest[] {
  return cards.filter((c) => !isWorkRequestArchived(c, jobs));
}
