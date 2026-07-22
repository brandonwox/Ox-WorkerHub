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
  | 'finance_manager'
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
 * Operator creates and maps to QuickBooks Time). Work Requests hang off a Job.
 */
// 'Finished' replaced the old 'Archived' value — legacy DB rows are mapped on
// read (see supabase/data.ts) and a migration renames the stored value.
export type JobStatus = 'Active' | 'Finished';

export interface Job {
  id: string;
  /**
   * e.g. "Snyderville Commercial Complex". Sub-job names are stored WITHOUT
   * the parent's name ("Lot 2", not "Vista Homes Lot 2") — surfaces that want
   * the combined form conjoin them at display time (utils/jobName.ts).
   */
  name: string;
  /** Jobsite address / location. */
  location: string;
  /**
   * The job's PO number, typed by the creator at creation (required there;
   * legacy jobs may lack one). Shown alongside the job name in lists and
   * detail headers, and matched by every search that matches job names.
   * Office-edited afterwards (Operator / Field Supers; DB guards match).
   */
  po?: string;
  status: JobStatus;
  /**
   * Set when this job is a SUB-JOB: a piece of the referenced parent job.
   * Sub-jobs behave exactly like jobs (own QBT jobcode, work requests, photos,
   * issues, documents) but: one level only, Field Supers are inherited from
   * the parent (mirrored server-side, never set directly), and office job
   * lists show them only inside their parent's Sub-Jobs section.
   */
  parentJobId?: string;
  /**
   * "This job has Sub-Jobs": shows the Sub-Jobs section on the job's details
   * page. A UI toggle persisted on the job (web users flip it; deactivating
   * hides the section but the sub-jobs themselves live on).
   */
  hasSubJobs?: boolean;
  /**
   * QuickBooks Time jobcode this Job maps to. Set manually by the Operator;
   * timesheet hours sync under this code. Optional until mapped.
   */
  qbtJobcodeId?: string;
  /**
   * Site-wide flashing material spec. Set by the Operator on create and editable
   * by the Field Super (their one writable Job field). Work Requests snapshot this
   * value at creation time. Optional until specified.
   */
  flashingMaterial?: string;
  /**
   * Reference photo of the Window Flashing Material, taken/uploaded by the
   * Field Super. Object path inside the job-photos bucket
   * ("<jobId>/flashing-<uuid>.jpg"). Shown wherever the flashing material text
   * appears — including every work request of this job.
   */
  flashingPhotoPath?: string;
  /** Renderable URL of the flashing photo (public bucket URL; local uri in dev). */
  flashingPhotoUrl?: string;
  /**
   * The {@link JobPhoto} shown as the job's cover on its details page. Unset
   * means "no explicit choice" — the app falls back to the job's oldest
   * photo. Any worker may change it ("Change jobsite photo"; RLS guards
   * installers/schedulers to this one column).
   */
  coverPhotoId?: string;
  /**
   * Total labor budget assigned to the job, in dollars. Set by the Finance
   * Manager; their jobs tab compares it against wages paid out (the summed
   * earnings of timesheets on this job's work requests).
   */
  laborBudget?: number;
  /**
   * Scope-driven done/total counts, displayed as "0/100" on the job details
   * page and every work request of the job. Window + SGD pairs belong to the
   * Windows scope; every other pair belongs to its same-named scope (see
   * JOB_COUNT_DEFS in utils/jobCounts.ts). Totals are office-set (the
   * Operator / Field Supers); installers update only the done numbers (from
   * the work request count popup; RLS matches). A count shows once its total is
   * set.
   */
  windowCountDone?: number;
  windowCountTotal?: number;
  sgdCountDone?: number;
  sgdCountTotal?: number;
  mirrorCountDone?: number;
  mirrorCountTotal?: number;
  showerCountDone?: number;
  showerCountTotal?: number;
  swingDoorCountDone?: number;
  swingDoorCountTotal?: number;
  screenCountDone?: number;
  screenCountTotal?: number;
  iguCountDone?: number;
  iguCountTotal?: number;
  /**
   * The Field Super marked layout plans as not needed for this job ("Window
   * layout plans not necessary"). Suppresses the layout-plan warning on the
   * job details page; a Windows-scoped job with neither this flag nor a
   * 'window_layout' document warns the Field Super. Mirror and Shower twins
   * below.
   */
  windowLayoutNotNeeded?: boolean;
  mirrorLayoutNotNeeded?: boolean;
  showerLayoutNotNeeded?: boolean;
  /**
   * Field Supers assigned to this job (worker ids, role `field_super`).
   * The Operator sets this; a job may have more than one Field Super. A Field
   * Super sees ONLY the jobs they're in here — and, transitively, only those
   * jobs' work requests. Empty/unset means no Field Super is assigned yet (nobody can
   * see it).
   */
  fieldSuperIds?: string[];
  /**
   * Trade scopes this job covers (Windows, Mirrors, …). Picked by the Operator
   * at creation and editable later. When the set excludes 'Windows', the Window
   * Opening Flashing Material is hidden everywhere for this job and its
   * work requests. Unset (legacy jobs) means "not narrowed" — every scope allowed.
   */
  scopes?: JobScope[];
}

/**
 * Status of a unit of work (a Work Request) as the crew reports it from the
 * field. 'Undefined' is the default — it means "nobody has reported yet" and
 * is never chosen by hand. Reporting 'Untouched' or 'False Start' requires a
 * typed reason, and 'Finished' carries a completion note (both stored in
 * {@link WorkRequest.statusNote}).
 */
export type WorkRequestStatus =
  | 'Undefined'
  | 'Untouched'
  | 'False Start'
  | 'Made Progress'
  | 'Finished';

/** All work request statuses, in display order. */
export const WORK_REQUEST_STATUSES: WorkRequestStatus[] = [
  'Undefined',
  'Untouched',
  'False Start',
  'Made Progress',
  'Finished',
];

/**
 * The statuses a worker can PICK in a status menu — everything except
 * 'Undefined', which only exists as the not-yet-reported default.
 */
export const SELECTABLE_WORK_REQUEST_STATUSES: WorkRequestStatus[] =
  WORK_REQUEST_STATUSES.filter((s) => s !== 'Undefined');

/** Statuses that require the worker to type why they chose them. */
export const STATUSES_REQUIRING_REASON: WorkRequestStatus[] = [
  'Untouched',
  'False Start',
];

/**
 * Field-Super-assigned importance of a Work Request. Distinct from `priorityOrder` (sort).
 * Free text so the Field Super can pick a preset ({@link PRIORITY_PRESETS}) or type a
 * custom value — older cards may still carry legacy 'Low' | 'Medium' | 'High'.
 */
export type WorkRequestPriority = string;

/** The preset priorities the Field Super picks from (a custom string is also allowed). */
export const PRIORITY_PRESETS = [
  'Now',
  'Tomorrow',
  'This Week',
  'Low Priority',
] as const;

/**
 * The choices in the range-based priority selector. Each resolves to a
 * start→end date window ({@link WorkRequest.priorityStartDate} /
 * {@link WorkRequest.priorityEndDate}); "Set dates" means the Field Super picks
 * both dates manually.
 */
export const PRIORITY_CHOICES = [
  'Now',
  'This week',
  'Next week',
  'Set dates',
] as const;
export type PriorityChoice = (typeof PRIORITY_CHOICES)[number];

/**
 * Trade scope a Job / Work Request covers. At least one is chosen at creation
 * time. Every scope behaves the same and is selectable on jobs, sub-jobs, AND
 * work requests alike (no request-only scopes). Legacy 'Showerglass Door'
 * values are mapped to 'Showers' on read and by migration.
 */
export type JobScope =
  | 'Windows'
  | 'Mirrors'
  | 'Showers'
  | 'Swing Doors'
  | 'Screens'
  | "IGU's"
  | 'Storefront'
  | 'Service';

/** All selectable scopes, in display order. */
export const JOB_SCOPES: JobScope[] = [
  'Windows',
  'Mirrors',
  'Showers',
  'Swing Doors',
  'Screens',
  "IGU's",
  'Storefront',
  'Service',
];

/**
 * Preset answers to "is this work request ready for installers?". Only 'Yes'
 * requests enter the schedulers' backlog pool; everything else waits in the
 * "Not ready yet" section. (Legacy values 'Now' / 'Over 2 Weeks' are mapped to
 * 'Yes' / 'No' on read and by migration.)
 */
export const READINESS_PRESETS = ['Yes', 'No', 'Soon'] as const;

/**
 * One discrete task on a Work Request. Authored by the Field Super / Scheduler;
 * installers check tasks off from their phone as the work completes. The id is
 * stable across text edits so check-offs and per-task issues never mis-link
 * when the task list is edited.
 */
export interface WorkRequestTask {
  id: string;
  /** What must be done (Field-Super-authored). */
  text: string;
  /** Checked off by an installer. */
  done: boolean;
  /** Installer who checked it off. */
  doneById?: string;
  /** ISO datetime it was checked off. */
  doneAt?: string;
}

/**
 * A Work Request is a ticket/task to be done on a {@link Job} (its parent). The
 * Field Super creates them; the Scheduler assigns them to crews; installers
 * perform the work. (Formerly the app's `Job` type — it has always been the
 * field work item.)
 */
export interface WorkRequest {
  id: string;
  /**
   * Primary linked Job (jobsite) — the row the DB foreign key points at.
   * Unset on a STANDALONE work request (created with "No parent job"; its
   * address is typed by hand instead of inherited) and on unmigrated legacy
   * data. When {@link jobIds} is set this is always its first entry.
   */
  jobId?: string;
  /**
   * Every linked job, in selection order — set only when the card is linked
   * to MORE than one. Multi-links are constrained to one family: sibling
   * sub-jobs of a single parent, optionally including that parent itself
   * (never two different parent jobs). {@link jobId} mirrors the first entry;
   * use utils/workRequestJobs.ts helpers instead of reading either directly.
   */
  jobIds?: string[];
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
  status: WorkRequestStatus;
  /**
   * Why the current status was chosen: the required reason for 'Untouched' /
   * 'False Start' (reviewed on the field super + scheduler dashboards) or the
   * completion note for 'Finished' ("Everything done, nothing left." /
   * "Everything but sheetrock" / custom text). Cleared when the status
   * changes to one that carries no note.
   */
  statusNote?: string;
  /** ISO datetime of the last status change (set alongside `status`). */
  statusChangedAt?: string;
  /** Worker who made the last status change. */
  statusChangedById?: string;
  /**
   * The day (yyyy-MM-dd) the 3:30 PM "status needs updating" reminder last
   * went out for this card — stops other sessions from re-pinging the foreman
   * the same day.
   */
  undefinedReminderDate?: string;
  priorityOrder: number;
  /** Field-Super-assigned priority. A {@link PRIORITY_PRESETS} value or a custom string. */
  priority: WorkRequestPriority;
  /**
   * Priority window start (yyyy-MM-dd). Set by the range-based priority
   * selector; absent on legacy cards created when priority was label-only.
   */
  priorityStartDate?: string;
  /**
   * Priority window end (yyyy-MM-dd). When this day arrives and the card
   * isn't finished, the card escalates to "Now" — visually right away, and
   * persisted (+ scheduler ping) by the store's escalation sweep.
   */
  priorityEndDate?: string;
  /**
   * Trades this card covers (Windows, Mirrors, …). At least one is chosen at
   * creation; only when 'Windows' is included is {@link flashingMaterial} shown.
   */
  scopes?: JobScope[];
  /**
   * Discrete tasks the installers must complete (and check off from their
   * phone). A card cannot be created without at least one.
   * Field-Super-authored; installers only toggle `done`.
   */
  tasks?: WorkRequestTask[];
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
  /**
   * Whether the crew must pick something up on the way. Answered Yes/No at
   * creation (required); Yes also requires {@link pickupLocation}.
   */
  pickupRequired?: boolean;
  /** Where the pickup is. Set (and required) only when {@link pickupRequired}. */
  pickupLocation?: string;
  /** Free-form Field Super notes captured at the bottom of the creation form. */
  notes?: string;
  /** @deprecated Superseded by {@link scopes} + {@link tasks}. Kept for legacy data. */
  scopeOfWork?: string;
  /**
   * Shared field notes updated by installers on site. Because a Work Request is a
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
  /**
   * ISO timestamp of when the card was created. Backend rows carry the DB's
   * `created_at`; absent on legacy local cards that predate the field.
   */
  createdAt?: string;
  details: {
    generalContractor: string;
    managerName: string;
    managerPhone: string;
  };
}

/** A permanent crew of installers. The default scheduling container. */
export interface Crew {
  id: string;
  /** A single letter ("A"). */
  name: string;
  /** Members — MUST all be workers with role 'installer'. */
  installerIds: string[];
  /**
   * The crew's foreman — the scheduler must pick exactly one per permanent
   * crew (no more, no less; always one of {@link installerIds}). Only the
   * foreman receives the 3:30 PM "status needs updating" notification.
   * Optional in the type only because crews created before the tag existed
   * may not have one yet. Daily crews have no foreman.
   */
  foremanId?: string;
  /**
   * Scheduler-picked display color (#RRGGBB). Unset = the automatic palette
   * assignment by alphabetical position (see buildCrewColorMap).
   */
  color?: string;
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
  /** Up to 20 characters (unlike permanent crews' single letter). */
  name: string;
  /** Members — installers only. */
  installerIds: string[];
  /** Scheduler-picked display color (#RRGGBB); unset = automatic palette. */
  color?: string;
}

/**
 * A scheduler-authored day note ("Brandon off all day"). Renders like a work
 * request chip on the calendars, but carries only a date, title, and
 * description — no crew, tasks, or status. Everyone signed in can see events
 * (installers get them on their agenda); only schedulers create/edit/move
 * them. Shares the per-day ordering space with work requests via
 * {@link priorityOrder}, so events drag-and-drop like requests.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  /** The day the event sits on (yyyy-MM-dd). */
  date: string;
  /** Intra-day sort key (same space as {@link WorkRequest.priorityOrder}). */
  priorityOrder: number;
  /** Scheduler who created the event. */
  createdById?: string;
  /** ISO timestamp (DB-stamped). */
  createdAt?: string;
}

/**
 * Single-source-of-truth link: a Work Request placed on a crew for a date. The
 * Work Request itself is never duplicated; multiple assignments fan it out to
 * multiple crews/dates.
 */
export interface ScheduleAssignment {
  id: string;
  workRequestId: string;
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
  workRequestId?: string;
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
  workRequestId?: string;
  customProjectName?: string;
  /** ISO datetime string */
  startTime: string;
}

// --- Job photos --------------------------------------------------------------

/**
 * A photo of the work on a jobsite. Always attached to the parent {@link Job}
 * (that's where crews and the office browse them); optionally linked to the
 * {@link WorkRequest} it was taken for when captured from a work request's screen. The
 * image bytes live in the `job-photos` Supabase Storage bucket; this record is
 * the metadata.
 */
export interface JobPhoto {
  id: string;
  /** Parent Job (jobsite) the photo documents. */
  jobId: string;
  /** The work request the photo was taken for, when captured from its screen. */
  workRequestId?: string;
  /**
   * The issue the photo documents, when captured from an issue's photo
   * buttons. Issue photos render inside their issue (on the work request and the
   * parent job) instead of the general photo grids.
   */
  issueId?: string;
  /**
   * The work request task ({@link WorkRequestTask.id}) the photo documents, when
   * captured from a task's camera button. Installers must attach at least one
   * photo to a task before they can check it off.
   */
  taskId?: string;
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
  /** True when this is a VIDEO taken in the photo taker (stored as .mp4). */
  isVideo?: boolean;
  /**
   * The taker confirmed this video shows SGD work ("Were any SGD videos
   * taken?" popup on leaving the camera of a Windows-scope work request).
   * Drives the "SGD Videos" filter in the Pictures sections.
   */
  sgdVideo?: boolean;
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
  workRequestId?: string;
  /** The issue the photo documents (see {@link JobPhoto.issueId}). */
  issueId?: string;
  /** The work request task the photo documents (see {@link JobPhoto.taskId}). */
  taskId?: string;
  workerId: string;
  /** Local file uri (native) or blob uri (web) of the compressed image. */
  localUri: string;
  note?: string;
  /** ISO datetime the photo was taken. */
  takenAt: string;
  state: PendingPhotoState;
  /** True when this is a video (uploads as .mp4 instead of .jpg). */
  isVideo?: boolean;
  /** Tagged as an SGD video before the upload landed (rides along). */
  sgdVideo?: boolean;
}

// --- Job issues ---------------------------------------------------------------

/** Lifecycle of a field-reported issue. Field Supers resolve open issues. */
export type JobIssueStatus = 'open' | 'resolved';

/**
 * A problem an installer flags from a work request's screen (missing material, site
 * not ready, damage, …). Always attached to the parent {@link Job} — the job's
 * page lists every issue with a link back to the work request it was raised on —
 * and linked to the {@link WorkRequest} it was created from. Photos documenting the
 * issue are {@link JobPhoto}s carrying this issue's id.
 */
export interface JobIssue {
  id: string;
  /** Parent Job (jobsite) the issue belongs to. */
  jobId: string;
  /** The work request the issue was raised on (cleared if that card is deleted). */
  workRequestId?: string;
  /** The work request task ({@link WorkRequestTask.id}) the issue was raised for. */
  taskId?: string;
  /** Installer who raised the issue. */
  workerId: string;
  /** What's wrong, written by the installer. */
  description: string;
  status: JobIssueStatus;
  /** Field Super who resolved it (set with status = 'resolved'). */
  resolvedById?: string;
  /** ISO datetime the issue was resolved. */
  resolvedAt?: string;
  /** ISO datetime the issue was raised. */
  createdAt: string;
}

/** What a job document holds: an image, a PDF file, or a plain text note. */
export type JobDocumentKind = 'photo' | 'pdf' | 'text';

/**
 * Optional installer-facing document type. A typed document displays its type
 * label alongside the title ("Window Layout Plans · West face") so installers
 * can find the right plan fast. Having a 'window_layout' document (or the
 * job's {@link Job.windowLayoutNotNeeded} flag) clears the Field Super's
 * layout-plan warning on Windows-scoped jobs; 'mirror_layout' and
 * 'shower_layout' mirror that for Mirrors- and Showers-scoped jobs.
 */
export type JobDocumentType =
  | 'window_layout'
  | 'mirror_layout'
  | 'shower_layout'
  | 'flashing_example';

/** Display labels for {@link JobDocumentType}, in selector order. */
export const JOB_DOCUMENT_TYPE_LABELS: Record<JobDocumentType, string> = {
  window_layout: 'Window Layout Plans',
  mirror_layout: 'Mirror Layout Plans',
  shower_layout: 'Shower Layout Plans',
  flashing_example: 'Window Flashing Example',
};

/**
 * A document attached to a {@link Job}: a photo, a PDF, or a text note, each
 * with a required title. Created by any non-installer role (installers can
 * view them); listed in the Documents section of the job details page. File
 * bytes live in the job-documents storage bucket.
 */
export interface JobDocument {
  id: string;
  /** Parent Job (jobsite) the document belongs to. */
  jobId: string;
  /** Worker who created the document. */
  workerId: string;
  kind: JobDocumentKind;
  /** Optional type tag ({@link JobDocumentType}); shown next to the title. */
  docType?: JobDocumentType;
  /** Display title, typed at creation (required). */
  title: string;
  /** The content of a 'text' document. */
  body?: string;
  /** Object path inside the job-documents bucket (photo/pdf kinds). */
  storagePath?: string;
  /** Renderable/openable URL (public bucket URL; a local uri in local dev). */
  url?: string;
  /** ISO datetime the document was created. */
  createdAt: string;
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
 *  - `work_request_now`: a Field Super marks a work request "Now" → ping schedulers.
 *  - `schedule_change`: an installer's schedule for TODAY changed (a card added,
 *    removed, re-prioritized, or edited) → ping that installer.
 *  - `save_failed`: one of this worker's queued changes was rejected by the
 *    server and dropped. Device-local only (never written to the DB — it's
 *    about THIS device's sync queue).
 */
/**
 *  - `status_update_needed`: the 3:30 PM sweep found a work request scheduled
 *    today/yesterday whose status is still 'Undefined' → ping the assigned
 *    crew's FOREMAN (only the foreman is notified).
 */
export type NotificationType =
  | 'work_request_now'
  | 'schedule_change'
  | 'save_failed'
  | 'status_update_needed';

/**
 * A targeted ping for a single worker. Created by whatever action warrants it
 * (e.g. the store dispatches one to every scheduler when a work request becomes
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
  /** Type-specific payload, e.g. `{ workRequestId }` for a 'work_request_now'. */
  data?: Record<string, unknown>;
  /** False until the recipient opens/acknowledges it (drives the unread badge). */
  read: boolean;
  /** ISO datetime the notification was created. */
  createdAt: string;
}
