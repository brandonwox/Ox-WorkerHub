import { Job } from '@/types';

/** One displayable done/total pair on a job ("Window Count 0/100"). */
export interface JobCount {
  /** The Job field holding the done number (the edit popup writes this). */
  doneField: 'windowCountDone' | 'sgdCountDone' | 'mirrorCountDone';
  /** e.g. "Window Count". */
  label: string;
  done: number;
  total: number;
}

/**
 * The counts a job displays: any pair whose TOTAL has been set (no nagging
 * "0/0" before the office enters a total). Window + SGD pairs belong to the
 * Windows scope, Mirror to Mirrors — which pairs are *editable* is
 * scope-gated at the edit surfaces; display simply follows the data.
 */
export function jobCounts(job: Job | undefined | null): JobCount[] {
  if (!job) return [];
  const out: JobCount[] = [];
  if (job.windowCountTotal != null) {
    out.push({
      doneField: 'windowCountDone',
      label: 'Window Count',
      done: job.windowCountDone ?? 0,
      total: job.windowCountTotal,
    });
  }
  if (job.sgdCountTotal != null) {
    out.push({
      doneField: 'sgdCountDone',
      label: 'SGD Count',
      done: job.sgdCountDone ?? 0,
      total: job.sgdCountTotal,
    });
  }
  if (job.mirrorCountTotal != null) {
    out.push({
      doneField: 'mirrorCountDone',
      label: 'Mirror Count',
      done: job.mirrorCountDone ?? 0,
      total: job.mirrorCountTotal,
    });
  }
  return out;
}

/** "0/100" — always done first, total second. */
export function formatCount(count: JobCount): string {
  return `${count.done}/${count.total}`;
}
