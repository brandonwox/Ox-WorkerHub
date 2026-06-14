/**
 * Which interface and permissions a person gets in the app. `developer` is a
 * special role: it has no UI of its own, but it is the ONLY role allowed to use
 * the "View as" dev switcher to impersonate the other roles.
 */
export type AppRole =
  | 'installer'
  | 'scheduler'
  | 'operator'
  | 'project_manager'
  | 'developer';

/** Account lifecycle. `invited` until the person accepts their email invite. */
export type WorkerStatus = 'invited' | 'active';

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Drives which interface this person sees. */
  role: AppRole;
  /** Trade specialty, e.g. 'Glazier'. Only meaningful for installers. */
  tradeRole: string;
  /** Pay rate in dollars/hour. Only meaningful for installers. */
  hourlyRate: number;
  status: WorkerStatus;
}

/** @deprecated kept as an alias while call sites migrate to {@link Worker}. */
export type User = Worker;

/**
 * A Job is a jobsite / project the company works on (the parent entity the
 * Operator creates and maps to QuickBooks Time). Jobcards hang off a Job.
 */
export type JobStatus = 'Active' | 'Archived';

export interface Job {
  id: string;
  /** e.g. "Snyderville Commercial Complex". */
  name: string;
  /** Jobsite address / location. */
  location: string;
  status: JobStatus;
  /**
   * QuickBooks Time jobcode this Job maps to. Set manually by the Operator;
   * timesheet hours sync under this code. Optional until mapped.
   */
  qbtJobcodeId?: string;
  /**
   * Site-wide flashing material spec. Set by the Operator on create and editable
   * by the Project Manager (their one writable Job field). Jobcards snapshot this
   * value at creation time. Optional until specified.
   */
  flashingMaterial?: string;
}

/** Status of a unit of work (a Jobcard) as it moves through the field. */
export type JobcardStatus = 'Upcoming' | 'In Progress' | 'Finished';

/** PM-assigned importance of a Jobcard. Distinct from `priorityOrder` (sort). */
export type JobcardPriority = 'Low' | 'Medium' | 'High';

/**
 * A Jobcard is a ticket/task to be done on a {@link Job} (its parent). The
 * Project Manager creates them; the Scheduler assigns them to crews; installers
 * perform the work. (Formerly the app's `Job` type — it has always been the
 * field work item.)
 */
export interface Jobcard {
  id: string;
  /** Parent Job (jobsite). Optional only while legacy/seed data is migrated. */
  jobId?: string;
  title: string;
  address: string;
  /** Scheduled calendar day (yyyy-MM-dd). Always set. */
  date: string;
  /**
   * Optional time window the worker is expected on site. Most cards won't have
   * one assigned — the office side can set it when a window matters.
   * ISO datetime string.
   */
  startTime?: string;
  /** ISO datetime string. Set together with startTime. */
  endTime?: string;
  status: JobcardStatus;
  priorityOrder: number;
  /** PM-assigned priority. Defaults to 'Medium'. */
  priority: JobcardPriority;
  /**
   * Flashing material inherited from the parent Job AT CREATION TIME (a snapshot,
   * not a live link — so later Job edits don't silently mutate existing cards).
   */
  flashingMaterial?: string;
  /** Task-specific / additional materials needed (free text). PM-authored. */
  materials?: string;
  /** Scope of work / what's required on this card (free text). PM-authored. */
  scopeOfWork?: string;
  /**
   * Shared field notes updated by installers on site. Because a Jobcard is a
   * single shared record, a note added by one crew is visible to every crew the
   * card is assigned to.
   */
  fieldNotes?: string;
  /**
   * TEMPORARY: which installer sees this card. The real model assigns work to
   * crews on dates (Permanent/Daily Crews), not to individuals — this field is
   * a stand-in to keep the installer app working until crew scheduling lands.
   */
  assignedInstallerId?: string;
  details: {
    generalContractor: string;
    managerName: string;
    managerPhone: string;
  };
}

/** A permanent crew of installers. The default scheduling container. */
export interface Crew {
  id: string;
  /** e.g. "Crew Alpha". */
  name: string;
  /** Members — MUST all be workers with role 'installer'. */
  installerIds: string[];
}

/**
 * A temporary, date-specific crew that overrides permanent crews for ONE day.
 * Installers listed here are treated as working under this crew on `date`
 * instead of their permanent crew (prevents double-booking).
 */
export interface DailyCrew {
  id: string;
  /** The single day this override applies to (yyyy-MM-dd). */
  date: string;
  name: string;
  /** Members — installers only. */
  installerIds: string[];
}

/**
 * Single-source-of-truth link: a Jobcard placed on a crew for a date. The
 * Jobcard itself is never duplicated; multiple assignments fan it out to
 * multiple crews/dates.
 */
export interface ScheduleAssignment {
  id: string;
  jobcardId: string;
  /** References a Crew.id OR a DailyCrew.id. */
  crewId: string;
  /** yyyy-MM-dd the work is scheduled for. */
  date: string;
}

/**
 * QBT delivery state of a timesheet. Timesheets are auto-approved (there is no
 * in-app approval), so the only status worth surfacing is whether the weekly
 * sweep has delivered the hours to QuickBooks Time.
 *  - 'unsent': logged, not yet pushed (no badge shown).
 *  - 'sent':   delivered to QuickBooks Time.
 *  - 'failed': the last push attempt failed.
 */
export type TimesheetSendStatus = 'unsent' | 'sent' | 'failed';

export interface TimesheetLog {
  id: string;
  /** Worker who logged these hours. */
  workerId: string;
  /** ISO date string (yyyy-MM-dd) */
  date: string;
  jobcardId?: string;
  customProjectName?: string;
  /** ISO datetime string */
  startTime: string;
  /** ISO datetime string */
  endTime: string;
  totalHours: number;
  earnedAmount: number;
  /** QBT delivery state. 'unsent' when first logged; the weekly sweep sets the rest. */
  sendStatus: TimesheetSendStatus;
}

export interface ActiveShift {
  jobcardId?: string;
  customProjectName?: string;
  /** ISO datetime string */
  startTime: string;
}

// --- QuickBooks Time integration ---

/**
 * Lifecycle of a single timecard with respect to QuickBooks Time.
 *  - unsynced:  never pushed (or cleared after an edit).
 *  - syncing:   a create/update request is in flight.
 *  - submitted: created in QBT, sitting in the payroll manager's queue.
 *  - approved:  payroll manager approved the date this log falls on.
 *  - error:     last push failed; `error` holds the reason.
 */
export type QbtSyncStatus =
  | 'unsynced'
  | 'syncing'
  | 'submitted'
  | 'approved'
  | 'error';

export interface QbtSyncRecord {
  status: QbtSyncStatus;
  /** QBT timesheet id once the timecard has been created there. */
  qbtTimesheetId?: number;
  /** ISO datetime of the last successful push. */
  lastSyncedAt?: string;
  /** Human-readable reason for the last failed attempt. */
  error?: string;
}

/** A QuickBooks Time jobcode (their term for a project/task hours book to). */
export interface QbtJobcode {
  id: number;
  name: string;
  active: boolean;
  /** 'regular' | 'pto' | 'paid_break' | 'unpaid_break'. We map to 'regular'. */
  type: string;
  /** 0 for top-level jobcodes, otherwise the parent jobcode id. */
  parentId: number;
}

/** Identity of the connected QuickBooks Time account. */
export interface QbtConnection {
  userId: number;
  name: string;
  companyName?: string;
}

export interface QbtConfig {
  /** Personal API access token (sent as a Bearer token). '' = not configured. */
  accessToken: string;
  /** API base URL. Defaults to https://rest.tsheets.com/api/v1. */
  baseUrl: string;
  /** When true, a timecard is pushed to QBT as soon as it is logged. */
  autoSync: boolean;
}
