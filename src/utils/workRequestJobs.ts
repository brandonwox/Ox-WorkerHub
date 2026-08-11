import { Job, WorkRequest } from '@/types';
import { jobDisplayName, parentJobOf } from '@/utils/jobName';

/** The card fields the job-link helpers need (accepts drafts and full cards). */
type JobLinked = Pick<WorkRequest, 'jobId' | 'jobIds'>;

/**
 * Every job id a work request is linked to, in selection order. Single-job
 * cards (and legacy rows, which predate `jobIds`) yield their `jobId` alone;
 * standalone cards yield []. Read links through this instead of `jobId` so
 * multi-sub-job cards are never mistaken for single-job ones.
 */
export function workRequestJobIds(card: JobLinked): string[] {
  if (card.jobIds && card.jobIds.length > 0) return card.jobIds;
  return card.jobId ? [card.jobId] : [];
}

/** Whether the work request is linked to the given job. */
export function workRequestLinksJob(card: JobLinked, jobId: string): boolean {
  return workRequestJobIds(card).includes(jobId);
}

/**
 * Display label for a card's linked job(s). Multi-links are always one family
 * (sibling sub-jobs ± their parent), so the parent's name renders once:
 * "Vista Homes Lot 2, Lot 5". Falls back to '' when nothing is linked (the
 * call site chooses its own "Unlinked job" / "No parent job" copy).
 */
/**
 * PO label for a card's linked job(s) — the office's job identifier. Sub-jobs
 * show their OWN PO (never the parent's); multi-linked cards join every linked
 * job's PO ("4512, 4513"). Jobs without a PO (legacy) fall back to their
 * display name so the line never goes blank. '' when nothing is linked (the
 * call site chooses its own fallback copy).
 */
export function workRequestPoLabel(card: JobLinked, jobs: Job[]): string {
  const linked = workRequestJobIds(card)
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is Job => j != null);
  return linked
    .map((j) => j.po?.trim() || jobDisplayName(j, jobs))
    .filter(Boolean)
    .join(', ');
}

export function workRequestJobsLabel(card: JobLinked, jobs: Job[]): string {
  const linked = workRequestJobIds(card)
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is Job => j != null);
  if (linked.length === 0) return '';
  if (linked.length === 1) return jobDisplayName(linked[0], jobs);
  const subs = linked.filter((j) => j.parentJobId);
  const parent =
    linked.find((j) => !j.parentJobId) ?? parentJobOf(subs[0], jobs);
  if (!parent) return linked.map((j) => jobDisplayName(j, jobs)).join(', ');
  const subNames = subs.map((j) => j.name).join(', ');
  return subNames ? `${parent.name} ${subNames}` : parent.name;
}
