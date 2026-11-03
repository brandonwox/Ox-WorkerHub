import { Job, JobScope } from '@/types';

/** The Job fields that hold a count's done (installed) number. */
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

/** The Job fields that hold a count's delivered (on-site) number. */
export type CountDeliveredField =
  | 'windowCountDelivered'
  | 'sgdCountDelivered'
  | 'mirrorCountDelivered'
  | 'showerCountDelivered'
  | 'swingDoorCountDelivered'
  | 'screenCountDelivered'
  | 'iguCountDelivered';

/** One count's definition: which scope owns it and where its numbers live. */
export interface JobCountDef {
  /** The job scope this count belongs to (gates the edit surfaces). */
  scope: JobScope;
  /** e.g. "Window Count". */
  label: string;
  doneField: CountDoneField;
  totalField: CountTotalField;
  deliveredField: CountDeliveredField;
  /** "All Windows are On Site" — shown once every unit has been delivered. */
  onSiteLabel: string;
}

/**
 * Every count, in display order. Window + SGD both belong to the Windows
 * scope (SGDs ride along with window packages); every other count belongs to
 * its same-named scope. Storefront and Service carry no counts.
 */
export const JOB_COUNT_DEFS: JobCountDef[] = [
  {
    scope: 'Windows',
    label: 'Window Count',
    doneField: 'windowCountDone',
    totalField: 'windowCountTotal',
    deliveredField: 'windowCountDelivered',
    onSiteLabel: 'All Windows are On Site',
  },
  {
    scope: 'Windows',
    label: 'SGD Count',
    doneField: 'sgdCountDone',
    totalField: 'sgdCountTotal',
    deliveredField: 'sgdCountDelivered',
    onSiteLabel: 'All SGDs are On Site',
  },
  {
    scope: 'Mirrors',
    label: 'Mirror Count',
    doneField: 'mirrorCountDone',
    totalField: 'mirrorCountTotal',
    deliveredField: 'mirrorCountDelivered',
    onSiteLabel: 'All Mirrors are On Site',
  },
  {
    scope: 'Showers',
    label: 'Shower Count',
    doneField: 'showerCountDone',
    totalField: 'showerCountTotal',
    deliveredField: 'showerCountDelivered',
    onSiteLabel: 'All Showers are On Site',
  },
  {
    scope: 'Swing Doors',
    label: 'Swing Door Count',
    doneField: 'swingDoorCountDone',
    totalField: 'swingDoorCountTotal',
    deliveredField: 'swingDoorCountDelivered',
    onSiteLabel: 'All Swing Doors are On Site',
  },
  {
    scope: 'Screens',
    label: 'Screen Count',
    doneField: 'screenCountDone',
    totalField: 'screenCountTotal',
    deliveredField: 'screenCountDelivered',
    onSiteLabel: 'All Screens are On Site',
  },
  {
    scope: "IGU's",
    label: 'IGU Count',
    doneField: 'iguCountDone',
    totalField: 'iguCountTotal',
    deliveredField: 'iguCountDelivered',
    onSiteLabel: "All IGU's are On Site",
  },
];

/**
 * One displayable count on a job: installed and delivered numbers against
 * one total ("Window Count · 12/100 installed · 40/100 delivered").
 */
export interface JobCount {
  /** The Job field holding the installed number (the edit popup writes this). */
  doneField: CountDoneField;
  /** The Job field holding the delivered number. */
  deliveredField: CountDeliveredField;
  /** e.g. "Window Count". */
  label: string;
  /** Installed so far. */
  done: number;
  /** Delivered to the site so far. */
  delivered: number;
  total: number;
  /** Every unit is on site: delivered ≥ total (and there IS a total). */
  onSite: boolean;
  /** "All Windows are On Site" — the line shown while {@link onSite}. */
  onSiteLabel: string;
}

/**
 * The on-site line for a work request's OWN delivery count (Delivery scope)
 * once its delivered number reaches the total.
 */
export const DELIVERY_ON_SITE_LABEL = 'Delivery complete — everything is on site';

/** Whether a delivered number has reached a (set, non-zero) total. */
export function isCountComplete(
  delivered: number | undefined,
  total: number | undefined
): boolean {
  return total != null && total > 0 && delivered != null && delivered >= total;
}

/**
 * Whether an edit just COMPLETED a delivery: complete after, not before. The
 * store's `delivery_complete` ping (and the DB email trigger, which applies
 * the same rule server-side) fires on exactly this transition — re-saving an
 * already-complete count stays silent.
 */
export function countBecameComplete(
  oldDelivered: number | undefined,
  oldTotal: number | undefined,
  newDelivered: number | undefined,
  newTotal: number | undefined
): boolean {
  return (
    isCountComplete(newDelivered, newTotal) &&
    !isCountComplete(oldDelivered, oldTotal)
  );
}

/**
 * The counts a job displays: any count whose TOTAL has been set (no nagging
 * "0/0" before the office enters a total). Which counts are *editable* is
 * scope-gated at the edit surfaces; display simply follows the data.
 */
export function jobCounts(job: Job | undefined | null): JobCount[] {
  if (!job) return [];
  const out: JobCount[] = [];
  for (const def of JOB_COUNT_DEFS) {
    const total = job[def.totalField];
    if (total == null) continue;
    const delivered = job[def.deliveredField] ?? 0;
    out.push({
      doneField: def.doneField,
      deliveredField: def.deliveredField,
      label: def.label,
      done: job[def.doneField] ?? 0,
      delivered,
      total,
      onSite: isCountComplete(delivered, total),
      onSiteLabel: def.onSiteLabel,
    });
  }
  return out;
}

/**
 * The counts the office may EDIT on a job, given its scopes: every count
 * whose scope the job covers. A job with no scopes recorded (legacy "not
 * narrowed") allows every count — matching jobAllowsWindows' legacy behavior.
 */
export function editableCountDefs(job: Job | undefined | null): JobCountDef[] {
  if (!job) return [];
  const scopes = job.scopes ?? [];
  if (scopes.length === 0) return JOB_COUNT_DEFS;
  return JOB_COUNT_DEFS.filter((def) => scopes.includes(def.scope));
}

/** "12/100" — the INSTALLED number over the total. */
export function formatCount(count: JobCount): string {
  return `${count.done}/${count.total}`;
}

/** "40/100" — the DELIVERED number over the total. */
export function formatDelivered(count: JobCount): string {
  return `${count.delivered}/${count.total}`;
}

/**
 * One summary line per count for the job surfaces:
 * "Window Count · 12/100 installed · 40/100 delivered", with
 * " · ✓ All Windows are On Site" appended once every unit is delivered.
 */
export function formatCountLine(count: JobCount): string {
  const base = `${count.label} · ${formatCount(count)} installed · ${formatDelivered(count)} delivered`;
  return count.onSite ? `${base} · ✓ ${count.onSiteLabel}` : base;
}
