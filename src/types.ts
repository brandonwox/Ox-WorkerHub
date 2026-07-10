/**
 * Which interface and permissions a person gets in the app. `developer` is a
 * special role: it has no UI of its own, but it is the ONLY role allowed to use
 * the "View as" dev switcher to impersonate the other roles.
 */
export type AppRole =
  | 'installer'
  | 'scheduler'
  | 'operator'
  | 'field_super'
  | 'developer';

/** Account lifecycle. `invited` until the person accepts their email invite. */
export type WorkerStatus = 'invited' | 'active';

/**
 * An installer's specialty title. Purely cosmetic — it does not affect any
 * scheduling or permissions; it's a label the Operator assigns per installer.
 */
export type InstallerType =
  | 'Window Installer'
  | 'Storefront Installer'
  | 'ShowerGlassDoor Installer'
  | 'Remodel Installer';

/** All installer types, in display order. */
export const INSTALLER_TYPES: InstallerType[] = [
  'Window Installer',
  'Storefront Installer',
  'ShowerGlassDoor Installer',
  'Remodel Installer',
];

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Drives which interface this person sees. */
  role: AppRole;
  /** Trade specialty, e.g. 'Glazier'. Only meaningful for installers. */
  tradeRole: string;
  /**
   * Operator-assigned installer specialty title (cosmetic only). Empty/unset
   * until the Operator picks one. Only meaningful for installers.
   */
  installerType?: InstallerType;
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
   * by the Field Super (their one writable Job field). Jobcards snapshot this
   * value at creation time. Optional until specified.
   */
  flashingMaterial?: string;
  /**
   * Field Supers assigned to this job (worker ids, role `field_super`).
   * The Operator sets this; a job may have more than one Field Super. A Field
   * Super sees ONLY the jobs they're in here — and, transitively, only those
   * jobs' jobcards. Empty/unset means no Field Super is assigned yet (nobody can
   * see it).
   */
  fieldSuperIds?: string[];
}

/** Status of a unit of work (a Jobcard) as it moves through the field. */
export type JobcardStatus = 'Upcoming' | 'In Progress' | 'Finished';

/**
 * Field-Super-assigned importance of a Jobcard. Distinct from `priorityOrder` (sort).
 * Free text so the Field Super can pick a preset ({@link PRIORITY_PRESETS}) or type a
 * custom value — older cards may still carry legacy 'Low' | 'Medium' | 'High'.
 */
export type JobcardPriority = string;

/** The preset priorities the Field Super picks from (a custom string is also allowed). */
export const PRIORITY_PRESETS = [
  'Now',
  'Tomorrow',
  'This Week',
  'Low Priority',
] as const;

/** Trade scope a Jobcard covers. At least one is chosen at creation time. */
export type JobScope =
  | 'Windows'
  | 'Mirrors'
  | 'Storefront'
  | 'Service'
  | 'Showerglass Door';

/** All selectable scopes, in display order. */
export const JOB_SCOPES: JobScope[] = [
  'Windows',
  'Mirrors',
  'Storefront',
  'Service',
  'Showerglass Door',
];

/** Preset answers to "when is this jobcard ready for installers?". */
export const READINESS_PRESETS = ['Now', 'Soon', 'Over 2 Weeks'] as const;

/**
 * A Jobcard is a ticket/task to be done on a {@link Job} (its parent). The
 * Field Super creates them; the Scheduler assigns them to crews; installers
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
  /** Field-Super-assigned priority. A {@link PRIORITY_PRESETS} value or a custom string. */
  priority: JobcardPriority;
  /**
   * Trades this card covers (Windows, Mirrors, …). At least one is chosen at
   * creation; only when 'Windows' is included is {@link flashingMaterial} shown.
   */
  scopes?: JobScope[];
  /**
   * Discrete tasks the installers must complete. Each must be ≥15 chars; a card
   * cannot be created without at least one. Field-Super-authored.
   */
  tasks?: string[];
  /**
   * When the card is ready for installers to arrive — a {@link READINESS_PRESETS}
   * value ('Now' | 'Soon' | 'Over 2 Weeks') or a custom string.
   */
  readiness?: string;
  /**
   * Window Opening Flashing Material. Defaults to the parent Job's value at
   * creation time but the Field Super may customize it per card (a snapshot, not a live
   * link — so later Job edits don't silently mutate existing cards). Only
   * meaningful when the 'Windows' scope is selected.
   */
  flashingMaterial?: string;
  /** Task-specific / additional materials needed (free text, optional). Field-Super-authored. */
  materials?: string;
  /** Free-form Field Super notes captured at the bottom of the creation form. */
  notes?: string;
  /** @deprecated Superseded by {@link scopes} + {@link tasks}. Kept for legacy data. */
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

// --- Job photos --------------------------------------------------------------

/**
 * A photo of the work on a jobsite. Always attached to the parent {@link Job}
 * (that's where crews and the office browse them); optionally linked to the
 * {@link Jobcard} it was taken for when captured from a jobcard's screen. The
 * image bytes live in the `job-photos` Supabase Storage bucket; this record is
 * the metadata.
 */
export interface JobPhoto {
  id: string;
  /** Parent Job (jobsite) the photo documents. */
  jobId: string;
  /** The jobcard the photo was taken for, when captured from its screen. */
  jobcardId?: string;
  /** Worker who took/uploaded the photo. */
  workerId: string;
  /** Object path inside the job-photos bucket ("<jobId>/<photoId>.jpg"). */
  storagePath: string;
  /** Renderable image URL (public bucket URL; a local uri in local dev mode). */
  url: string;
  /** Caption written by the photographer (editable by them only). */
  note?: string;
  /** ISO datetime the photo was taken. */
  takenAt: string;
}

/** Upload lifecycle of a photo that hasn't reached the backend yet. */
export type PendingPhotoState = 'queued' | 'uploading' | 'failed';

/**
 * A photo captured on device but not yet delivered to Supabase. Kept separate
 * from {@link JobPhoto} so a realtime refetch never wipes queue state. Jobsites
 * have dead zones, so uploads queue and retry automatically until they land.
 */
export interface PendingJobPhoto {
  id: string;
  jobId: string;
  jobcardId?: string;
  workerId: string;
  /** Local file uri (native) or blob uri (web) of the compressed image. */
  localUri: string;
  note?: string;
  /** ISO datetime the photo was taken. */
  takenAt: string;
  state: PendingPhotoState;
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

// --- Notifications ----------------------------------------------------------

/**
 * Kind of a notification — drives the icon/copy and lets recipients filter.
 * Add a new member here as more ping triggers are built (the system is generic).
 *  - `jobcard_now`: a Field Super marks a jobcard "Now" → ping schedulers.
 *  - `schedule_change`: an installer's schedule for TODAY changed (a card added,
 *    removed, re-prioritized, or edited) → ping that installer.
 */
export type NotificationType = 'jobcard_now' | 'schedule_change';

/**
 * A targeted ping for a single worker. Created by whatever action warrants it
 * (e.g. the store dispatches one to every scheduler when a jobcard becomes
 * "Now") and delivered to the recipient's session — live via Supabase realtime
 * in production, or straight through the in-memory store in local dev.
 */
export interface AppNotification {
  id: string;
  /** The worker this notification is for. */
  recipientId: string;
  type: NotificationType;
  /** Short headline shown in the toast and the panel row. */
  title: string;
  /** Supporting line with the relevant details. */
  body: string;
  /** Type-specific payload, e.g. `{ jobcardId }` for a 'jobcard_now'. */
  data?: Record<string, unknown>;
  /** False until the recipient opens/acknowledges it (drives the unread badge). */
  read: boolean;
  /** ISO datetime the notification was created. */
  createdAt: string;
}
