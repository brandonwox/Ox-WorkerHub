import { Job, JobScope } from '@/types';

/** The Job fields that hold a count's done number. */
export type CountDoneField =
  | 'windowCountDone'
  | 'sgdCountDone'
  | 'mirrorCountDone'
  | 'showerCountDone'
  | 'swingDoorCountDone'
  | 'screenCountDone'
  | 'iguCountDone';

/** The Job fields that hold a count's total. */
export type CountTotalField =
  | 'windowCountTotal'
  | 'sgdCountTotal'
  | 'mirrorCountTotal'
  | 'showerCountTotal'
  | 'swingDoorCountTotal'
  | 'screenCountTotal'
  | 'iguCountTotal';

/** One count pair's definition: which scope owns it and where it lives. */
export interface JobCountDef {
  /** The job scope this pair belongs to (gates the edit surfaces). */
  scope: JobScope;
  /** e.g. "Window Count". */
  label: string;
  doneField: CountDoneField;
  totalField: CountTotalField;
}

/**
 * Every count pair, in display order. Window + SGD both belong to the Windows
 * scope (SGDs ride along with window packages); every other pair belongs to
 * its same-named scope. Storefront and Service carry no counts.
 */
export const JOB_COUNT_DEFS: JobCountDef[] = [
  {
    scope: 'Windows',
    label: 'Window Count',
    doneField: 'windowCountDone',
    totalField: 'windowCountTotal',
  },
  {
    scope: 'Windows',
    label: 'SGD Count',
    doneField: 'sgdCountDone',
    totalField: 'sgdCountTotal',
  },
  {
    scope: 'Mirrors',
    label: 'Mirror Count',
    doneField: 'mirrorCountDone',
    totalField: 'mirrorCountTotal',
  },
  {
    scope: 'Showers',
    label: 'Shower Count',
    doneField: 'showerCountDone',
    totalField: 'showerCountTotal',
  },
  {
    scope: 'Swing Doors',
    label: 'Swing Door Count',
    doneField: 'swingDoorCountDone',
    totalField: 'swingDoorCountTotal',
  },
  {
    scope: 'Screens',
    label: 'Screen Count',
    doneField: 'screenCountDone',
    totalField: 'screenCountTotal',
  },
  {
    scope: "IGU's",
    label: 'IGU Count',
    doneField: 'iguCountDone',
    totalField: 'iguCountTotal',
  },
];

/** One displayable done/total pair on a job ("Window Count 0/100"). */
export interface JobCount {
  /** The Job field holding the done number (the edit popup writes this). */
  doneField: CountDoneField;
  /** e.g. "Window Count". */
  label: string;
  done: number;
  total: number;
}

/**
 * The counts a job displays: any pair whose TOTAL has been set (no nagging
 * "0/0" before the office enters a total). Which pairs are *editable* is
 * scope-gated at the edit surfaces; display simply follows the data.
 */
export function jobCounts(job: Job | undefined | null): JobCount[] {
  if (!job) return [];
  const out: JobCount[] = [];
  for (const def of JOB_COUNT_DEFS) {
    const total = job[def.totalField];
    if (total == null) continue;
    out.push({
      doneField: def.doneField,
      label: def.label,
      done: job[def.doneField] ?? 0,
      total,
    });
  }
  return out;
}

/**
 * The count pairs the office may EDIT on a job, given its scopes: every pair
 * whose scope the job covers. A job with no scopes recorded (legacy "not
 * narrowed") allows every pair — matching jobAllowsWindows' legacy behavior.
 */
export function editableCountDefs(job: Job | undefined | null): JobCountDef[] {
  if (!job) return [];
  const scopes = job.scopes ?? [];
  if (scopes.length === 0) return JOB_COUNT_DEFS;
  return JOB_COUNT_DEFS.filter((def) => scopes.includes(def.scope));
}

/** "0/100" — always done first, total second. */
export function formatCount(count: JobCount): string {
  return `${count.done}/${count.total}`;
}
