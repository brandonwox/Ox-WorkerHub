import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  defaultJobcodeId,
  defaultJobcodeMap,
  defaultQbtConfig,
} from '@/integrations/quickbooksTime/config';
import { syncRealtimeAuth } from '@/integrations/supabase/auth';
import * as backend from '@/integrations/supabase/data';
import * as notificationsBackend from '@/integrations/supabase/notifications';
import { discardPhotoFile, stashPhotoFile } from '@/lib/photoFiles';
import {
  ActiveShift,
  AppNotification,
  AppRole,
  Crew,
  DailyCrew,
  Job,
  Jobcard,
  JobcardStatus,
  JobIssue,
  JobPhoto,
  JobStatus,
  NotificationType,
  PendingJobPhoto,
  QbtConfig,
  QbtConnection,
  QbtJobcode,
  QbtSyncRecord,
  ScheduleAssignment,
  TimesheetLog,
  Worker,
} from '@/types';
import { hoursBetween } from '@/utils/time';

/** Pay rate for a worker, or 0 if unknown. */
function rateForWorker(workers: Worker[], workerId: string): number {
  return workers.find((w) => w.id === workerId)?.hourlyRate ?? 0;
}

/**
 * Crews contain installers only. Filter an id list down to ids that resolve to a
 * worker whose role is 'installer' — the store-level backstop for that rule.
 */
function onlyInstallerIds(workers: Worker[], ids: string[]): string[] {
  return ids.filter(
    (id) => workers.find((w) => w.id === id)?.role === 'installer'
  );
}

/**
 * Write-through is active only for a real, non-Developer session. Dev mode (no
 * auth) and a signed-in Developer (who has no RLS write grants) both stay local.
 */
function backendActive(state: { authWorker: Worker | null }): boolean {
  return state.authWorker != null && state.authWorker.role !== 'developer';
}

/** Ids of every worker with the 'scheduler' role — the "Now" ping recipients. */
function schedulerIds(workers: Worker[]): string[] {
  return workers.filter((w) => w.role === 'scheduler').map((w) => w.id);
}

/**
 * Ping every scheduler that a jobcard is now top priority. Called from the
 * jobcard create/edit actions whenever a card's priority becomes "Now".
 */
function notifyNowJobcard(get: () => AppState, card: Jobcard): void {
  const state = get();
  const recipients = schedulerIds(state.workers);
  if (recipients.length === 0) return;
  const jobName = card.jobId
    ? state.jobs.find((j) => j.id === card.jobId)?.name
    : undefined;
  get().pushNotification({
    recipientIds: recipients,
    type: 'jobcard_now',
    title: 'New Priority Jobcard',
    body: `${card.title}${jobName ? ` · ${jobName}` : ''} needs scheduling now.`,
    data: { jobcardId: card.id },
  });
}

/** Local calendar day as yyyy-MM-dd — the same key schedules/assignments use. */
function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Installers whose ACTIVE crew on `date` is `crewId` — the people who actually
 * see that crew's cards that day (Daily-crew overrides applied). This is the
 * audience for any change to `crewId`'s board on `date`.
 */
function installersOnActiveCrewForDate(
  state: { workers: Worker[]; crews: Crew[]; dailyCrews: DailyCrew[] },
  crewId: string,
  date: string
): string[] {
  return state.workers
    .filter(
      (w) => w.role === 'installer' && activeCrewIdFor(state, w.id, date) === crewId
    )
    .map((w) => w.id);
}

/**
 * Installers who have `jobcardId` on TODAY's board — the union of the audiences
 * of every crew the card is assigned to today. Used when a card itself is edited
 * (priority/content) so only people scheduled on it today are pinged.
 */
function todaysInstallerAudienceForCard(
  state: {
    workers: Worker[];
    crews: Crew[];
    dailyCrews: DailyCrew[];
    assignments: ScheduleAssignment[];
  },
  jobcardId: string
): string[] {
  const today = todayStr();
  const crewIds = new Set(
    state.assignments
      .filter((a) => a.jobcardId === jobcardId && a.date === today)
      .map((a) => a.crewId)
  );
  const ids = new Set<string>();
  for (const crewId of crewIds) {
    for (const id of installersOnActiveCrewForDate(state, crewId, today)) {
      ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Ping each installer whose today-schedule changed with a "Your schedule has
 * changed" toast. `detail` is the trailing clause (e.g. "has been taken off your
 * calendar today"), giving a body like "Front glazing — has been taken off…".
 * A no-op when nobody is affected. Callers gate on the change being for TODAY —
 * a change to any other day is intentionally silent.
 */
function notifyScheduleChange(
  get: () => AppState,
  installerIds: string[],
  card: Jobcard,
  detail: string
): void {
  if (installerIds.length === 0) return;
  const jobName = card.jobId
    ? get().jobs.find((j) => j.id === card.jobId)?.name
    : undefined;
  get().pushNotification({
    recipientIds: installerIds,
    type: 'schedule_change',
    title: 'Your schedule has changed',
    body: `${card.title}${jobName ? ` · ${jobName}` : ''} ${detail}`,
    data: { jobcardId: card.id },
  });
}

/** Jobcard fields an installer sees on their card — an edit to any pings "updated". */
const INSTALLER_VISIBLE_FIELDS: (keyof Jobcard)[] = [
  'title',
  'address',
  'date',
  'startTime',
  'endTime',
  'scopes',
  'tasks',
  'readiness',
  'flashingMaterial',
  'materials',
  'notes',
];

/**
 * Fire-and-forget a Supabase write; surface failures without breaking the UI.
 * Logged as an error (not a warning) so a rejected write — e.g. an RLS policy
 * denying the row — is obvious in the console rather than silently dropped. The
 * thrown message carries the Postgres error, which names the offending table.
 *
 * On success it bumps the store's `savedTick` so the desktop sidebar can pop a
 * "Changes Saved" pill — this fires only for real backend writes (backendActive
 * gates every caller), so the Developer and local dev mode never trigger it.
 */
function write(p: Promise<unknown>): void {
  p.then(
    () => useAppStore.getState().signalSaved(),
    (e) => console.error('Supabase write failed (change not saved):', e)
  );
}

/**
 * RFC4122-ish v4 id for new records in backend mode (DB columns are uuid).
 * Exported for callers that mint ids for embedded records (jobcard tasks).
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Loads the in-memory mock seed for local development.
 *
 * The `require` lives inside `if (__DEV__)` so the production bundler (`expo
 * export`, where __DEV__ === false) eliminates this branch AND drops the entire
 * '@/data/mock' module from the graph — exactly how React Native keeps its dev
 * tooling out of release builds. The upshot: mock data is physically absent from
 * the deployed website bundle and can never load there. Only ever called by
 * enterDevMode() below.
 */
function loadDevSeed(): typeof import('@/data/mock') | null {
  if (__DEV__) {
    return require('@/data/mock');
  }
  return null;
}

/**
 * Mapping key for a timecard's project: jobcards map by id, custom projects by
 * lowercased name. Used both as the store key and the QBT jobcode lookup.
 */
export function jobcodeKeyFor(ref: {
  jobcardId?: string;
  customProjectName?: string;
}): string | null {
  if (ref.jobcardId) return `jobcard:${ref.jobcardId}`;
  if (ref.customProjectName) return `custom:${ref.customProjectName.trim().toLowerCase()}`;
  return null;
}

/** Live QuickBooks Time integration state. */
interface QbtState {
  config: QbtConfig;
  connection: QbtConnection | null;
  jobcodes: QbtJobcode[];
  /** Project key (see jobcodeKeyFor) -> QBT jobcode id. */
  jobcodeMap: Record<string, number>;
  /** Fallback jobcode for any log without a specific mapping. */
  defaultJobcodeId?: number;
  /** Per-log sync state, keyed by TimesheetLog id. */
  sync: Record<string, QbtSyncRecord>;
  /** Payroll window from the connected user (yyyy-MM-dd, inclusive). */
  submittedThrough?: string;
  approvedThrough?: string;
}

/** Visual tone of a sidebar flash message. */
export type FlashTone = 'success' | 'info' | 'warning';

interface AppState {
  /** Full roster across all roles. Empty until a real sign-in (or local dev mode). */
  workers: Worker[];
  /**
   * Local dev-mode base identity (a mock worker id) — the Developer. Set ONLY by
   * enterDevMode() in local development; empty otherwise.
   */
  devBaseUserId: string;
  /**
   * The real signed-in worker, resolved from the Supabase session. When set it
   * IS the base identity, overriding `devBaseUserId`.
   */
  authWorker: Worker | null;
  /**
   * True only in local dev after enterDevMode() loads the mock seed. Never true
   * in a production build (the dev entry point is compiled out). Distinguishes
   * "logged out" (show login) from "browsing mock data locally".
   */
  devMode: boolean;
  /**
   * False until the initial Supabase session lookup completes. The layouts wait
   * on this so a returning user isn't flashed the login screen on launch.
   */
  authResolved: boolean;
  /**
   * True while the session came from a password-recovery link (the Supabase
   * `PASSWORD_RECOVERY` event). The layouts route to /set-password so the user
   * can choose a new password instead of landing on their home page. Cleared
   * once the new password is saved (or on sign-out).
   */
  passwordRecovery: boolean;
  /**
   * Developer-only "View as" impersonation target (a mock worker id). Ignored
   * unless the base identity's role is `developer`.
   */
  viewAsUserId: string | null;
  /** Jobsites/projects (Operator-owned, mapped to QBT). */
  jobs: Job[];
  /** Field work items (children of jobs). Formerly `jobs`. */
  jobcards: Jobcard[];
  /** Permanent crews (installers only) — the default scheduling containers. */
  crews: Crew[];
  /** Date-specific crew overrides that win over permanent crews for one day. */
  dailyCrews: DailyCrew[];
  /** Jobcard→crew→date links (single source of truth; never duplicates a card). */
  assignments: ScheduleAssignment[];
  logs: TimesheetLog[];
  /** Jobsite photos hydrated from the backend (see also pendingPhotos). */
  jobPhotos: JobPhoto[];
  /** Installer-raised field issues (children of jobs, linked to jobcards). */
  jobIssues: JobIssue[];
  /**
   * Photos captured on THIS device still waiting to upload. Separate from
   * `jobPhotos` so a realtime refetch never wipes the queue; uploads retry
   * automatically until they land (jobsites have dead zones).
   */
  pendingPhotos: PendingJobPhoto[];
  activeShift: ActiveShift | null;
  qbt: QbtState;
  /**
   * All notifications currently held in memory. In backend mode these are the
   * signed-in worker's own rows (fetched + streamed via realtime); in local dev
   * mode every recipient's notifications live here and the UI filters by the
   * currently-viewed worker.
   */
  notifications: AppNotification[];
  /**
   * Monotonic counter bumped once every time a backend write succeeds. The
   * desktop sidebar watches it to flash a "Changes Saved" pill. It never fires
   * in local dev mode or for the Developer (neither writes to Supabase).
   */
  savedTick: number;

  /**
   * Transient system message shown in the desktop sidebar footer (bottom-left).
   * This is the single channel for every "system" toast — "Changes Saved",
   * "Assigned … to …", validation nudges, etc. — so they always land in one
   * consistent spot and never render behind the calendar or other content.
   */
  flashMessage: string | null;
  /** Tone of the current flash, driving its icon and accent color. */
  flashTone: FlashTone;
  /** Bumped on every `flash()` so repeating the same text still re-triggers. */
  flashTick: number;

  /** Developer-only "View as": impersonate a role for the UI (or null for none). */
  setViewAs: (userId: string | null) => void;
  /** Bump `savedTick` — called by the write helper after a successful DB write. */
  signalSaved: () => void;
  /** Flash a transient system message in the desktop sidebar footer. */
  flash: (message: string, tone?: FlashTone) => void;
  /** Set/clear the real signed-in worker (Supabase auth bootstrap). */
  setAuthWorker: (worker: Worker | null) => void;
  /** Mark the initial Supabase session lookup as complete. */
  setAuthResolved: (resolved: boolean) => void;
  /** Flag/clear the password-recovery session (drives the reset redirect). */
  setPasswordRecovery: (recovery: boolean) => void;
  /** Edit the current (effective) worker's own profile. */
  updateUser: (changes: Partial<Worker>) => void;

  // --- Backend hydration (Supabase store swap, Step 7d) ---
  /** Replace every collection with live Supabase data (on real sign-in). */
  loadBackendData: () => Promise<void>;
  /**
   * Re-read the core collections from Supabase without touching the auth session
   * or the notifications channel. Driven by the realtime data subscription so a
   * change another session makes (e.g. a Field Super creating a jobcard) streams into this
   * session's lists.
   */
  refreshBackendData: () => Promise<void>;
  /** Empty every collection (on sign-out) — leaves the app at the login gate. */
  clearData: () => void;
  /**
   * Local development only: load the in-memory mock seed and enter dev mode.
   * A no-op in production builds (the mock module is stripped from the bundle).
   */
  enterDevMode: () => void;

  // --- Worker management (Operator) ---
  /** Add a worker to the roster. Returns the created record. */
  addWorker: (worker: Omit<Worker, 'id' | 'status'> & { id?: string }) => Worker;
  updateWorker: (id: string, changes: Partial<Worker>) => void;
  /** Remove a worker from the roster (Operator). */
  removeWorker: (id: string) => void;
  setWorkerRole: (id: string, role: AppRole) => void;
  setWorkerRate: (id: string, hourlyRate: number) => void;

  // --- Jobs (jobsites — Operator) ---
  /** Create a jobsite. Returns the created record. */
  addJob: (job: Omit<Job, 'id' | 'status'> & { id?: string; status?: JobStatus }) => Job;
  updateJob: (id: string, changes: Partial<Job>) => void;
  /**
   * Delete a jobsite and everything hanging off it. Mirrors the DB's
   * `on delete cascade`: locally drops the job's jobcards and any schedule
   * assignments referencing those cards so in-memory state stays consistent.
   */
  removeJob: (id: string) => void;

  // --- Jobcards (field work items) ---
  /**
   * Create a Jobcard. `flashingMaterial` defaults to the parent Job's value
   * when omitted, but the caller may pass a per-card override.
   */
  addJobcard: (
    card: Omit<Jobcard, 'id' | 'status' | 'priorityOrder'> & {
      id?: string;
      status?: JobcardStatus;
      priorityOrder?: number;
    }
  ) => Jobcard;
  updateJobcard: (id: string, changes: Partial<Jobcard>) => void;
  /** Delete a Jobcard and any schedule assignments pointing at it. */
  deleteJobcard: (id: string) => void;
  /** Installer-facing: append/replace shared field notes on a Jobcard. */
  updateJobcardNotes: (id: string, fieldNotes: string) => void;
  setJobcardStatus: (jobcardId: string, status: JobcardStatus) => void;
  /** Installer-facing: check a jobcard task off (or un-check it). */
  setJobcardTaskDone: (jobcardId: string, taskId: string, done: boolean) => void;

  // --- Crews & scheduling (Scheduler) ---
  /** Create a permanent crew. Non-installer ids are dropped. Returns the record. */
  addCrew: (crew: Omit<Crew, 'id'> & { id?: string }) => Crew;
  updateCrew: (id: string, changes: Partial<Crew>) => void;
  removeCrew: (id: string) => void;
  /** Create a date-specific crew override. Non-installer ids are dropped. */
  addDailyCrew: (crew: Omit<DailyCrew, 'id'> & { id?: string }) => DailyCrew;
  updateDailyCrew: (id: string, changes: Partial<DailyCrew>) => void;
  removeDailyCrew: (id: string) => void;
  /** Place a Jobcard on a crew for a date. Idempotent on (jobcard, crew, date). */
  assignJobcard: (
    jobcardId: string,
    crewId: string,
    date: string
  ) => ScheduleAssignment;
  unassignJobcard: (assignmentId: string) => void;

  clockIn: (ref: { jobcardId?: string; customProjectName?: string }) => void;
  /** Ends the active shift and returns the generated log, or null if not clocked in. */
  clockOut: () => TimesheetLog | null;
  /** Adjusts the start time of the in-progress shift. */
  updateShiftStart: (startTime: string) => void;
  /** Reassigns the project/jobcard of the in-progress shift. */
  updateShiftProject: (ref: { jobcardId?: string; customProjectName?: string }) => void;
  updateLog: (
    logId: string,
    changes: Pick<
      Partial<TimesheetLog>,
      'date' | 'jobcardId' | 'customProjectName' | 'startTime' | 'endTime'
    >
  ) => void;
  deleteLog: (logId: string) => void;
  /** Creates a manual timecard from explicit start/end times. */
  addLog: (entry: {
    jobcardId?: string;
    customProjectName?: string;
    startTime: string;
    endTime: string;
  }) => TimesheetLog;

  // --- Job photos ---
  /**
   * Stage captured/picked images for a job (optionally linked to the jobcard
   * they were taken for) and start the upload queue. Files are moved into app
   * storage first so a queued upload survives an app restart. Returns the new
   * photo ids (in input order) so the caller can attach a note to one.
   */
  addJobPhotos: (input: {
    jobId: string;
    jobcardId?: string;
    issueId?: string;
    localUris: string[];
  }) => Promise<string[]>;
  /** Set/replace the caption on a photo (pending or uploaded). Owner-only in the UI. */
  setJobPhotoNote: (id: string, note: string) => void;
  /** Delete a photo — a queued one locally, an uploaded one from the backend too. */
  deleteJobPhoto: (id: string) => void;
  /** Re-queue failed uploads and kick the queue (also fired by the retry timer). */
  retryPhotoUploads: () => void;
  /**
   * Set/replace a job's Window Flashing Material reference photo. Uploads the
   * image immediately (no offline queue — it's a one-off reference shot taken
   * by the Field Super) and stores its path on the job, so every jobcard of the
   * job shows it. Returns false when the upload failed.
   */
  setJobFlashingPhoto: (jobId: string, localUri: string) => Promise<boolean>;

  // --- Job issues ---
  /**
   * Raise a new (empty) issue on a job from a jobcard's screen. Returns the
   * created record so the UI can focus its description input, or null when
   * signed out.
   */
  addJobIssue: (input: {
    jobId: string;
    jobcardId?: string;
    taskId?: string;
  }) => JobIssue | null;
  /** Set/replace an issue's description (creator-only in the UI). */
  updateJobIssueDescription: (id: string, description: string) => void;
  /** Field Super: mark an issue resolved (or reopen it). */
  setJobIssueResolved: (id: string, resolved: boolean) => void;
  /** Delete an issue. Its photos survive as plain job photos. */
  deleteJobIssue: (id: string) => void;

  // --- Timesheets → QuickBooks Time (Operator visibility) ---
  /**
   * Reflect a successful weekly sweep by flagging every un-sent/failed timesheet
   * as 'sent'. There is no in-app approval — approval happens inside QBT. Called
   * by the server-side sweep (Step 7); no user-facing button.
   */
  markTimesheetsSent: () => void;

  // --- Notifications ---
  /**
   * Create and deliver a notification to each recipient. In backend mode it
   * inserts one row per recipient (each recipient's session receives it over
   * realtime); in local dev mode it appends straight to the in-memory list.
   */
  pushNotification: (input: {
    recipientIds: string[];
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) => void;
  /** Append a notification that arrived over realtime (deduped by id). */
  receiveNotification: (notification: AppNotification) => void;
  /** Mark a single notification as read (acknowledged). */
  markNotificationRead: (id: string) => void;
  /** Mark every unread notification for the current worker as read. */
  markAllNotificationsRead: () => void;

  // --- QuickBooks Time ---
  setQbtConfig: (changes: Partial<QbtConfig>) => void;
  setQbtConnection: (connection: QbtConnection | null) => void;
  setQbtJobcodes: (jobcodes: QbtJobcode[]) => void;
  setQbtJobcodeMapping: (key: string, jobcodeId: number | undefined) => void;
  setQbtDefaultJobcode: (jobcodeId: number | undefined) => void;
  setQbtSyncRecord: (logId: string, record: QbtSyncRecord) => void;
  setQbtApprovalWindow: (
    submittedThrough: string | undefined,
    approvedThrough: string | undefined
  ) => void;
}

let nextLogId = 100;
let nextWorkerId = 100;
let nextJobId = 100;
let nextJobcardId = 100;
let nextIssueId = 100;
let nextCrewId = 100;
let nextDailyCrewId = 100;
let nextAssignmentId = 100;
let nextNotificationId = 100;

// Coalesces the burst of realtime row events one logical change can emit into a
// single collection refetch. Module-level so it survives across store calls.
let dataRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  // Start empty: real data arrives on Supabase sign-in, mock data only via
  // enterDevMode() in local development. The website thus shows no data until
  // a real worker signs in.
  workers: [],
  devBaseUserId: '',
  authWorker: null,
  viewAsUserId: null,
  jobs: [],
  jobcards: [],
  crews: [],
  dailyCrews: [],
  assignments: [],
  logs: [],
  jobPhotos: [],
  jobIssues: [],
  pendingPhotos: [],
  notifications: [],
  savedTick: 0,
  flashMessage: null,
  flashTone: 'success',
  flashTick: 0,
  devMode: false,
  authResolved: false,
  passwordRecovery: false,
  activeShift: null,
  qbt: {
    config: defaultQbtConfig(),
    connection: null,
    jobcodes: [],
    jobcodeMap: defaultJobcodeMap(),
    defaultJobcodeId: defaultJobcodeId(),
    sync: {},
  },

  setViewAs: (userId) => set({ viewAsUserId: userId }),

  signalSaved: () => {
    set((state) => ({ savedTick: state.savedTick + 1 }));
    get().flash('Changes Saved', 'success');
  },

  flash: (message, tone = 'info') =>
    set((state) => ({
      flashMessage: message,
      flashTone: tone,
      flashTick: state.flashTick + 1,
    })),

  setAuthWorker: (worker) => set({ authWorker: worker }),

  setAuthResolved: (authResolved) => set({ authResolved }),

  setPasswordRecovery: (passwordRecovery) => set({ passwordRecovery }),

  enterDevMode: () => {
    const seed = loadDevSeed();
    if (!seed) return; // production: mock module is stripped, nothing to load
    set({
      workers: seed.mockWorkers,
      jobs: seed.mockJobs,
      jobcards: seed.mockJobcards,
      crews: seed.mockCrews,
      dailyCrews: seed.mockDailyCrews,
      assignments: seed.mockAssignments,
      logs: seed.mockLogs,
      jobPhotos: [],
      jobIssues: [],
      pendingPhotos: [],
      devMode: true,
      devBaseUserId: seed.DEVELOPER_ID,
      viewAsUserId:
        Platform.OS === 'web' ? 'w-op' : seed.PRIMARY_INSTALLER_ID,
      authWorker: null,
      authResolved: true,
    });
  },

  loadBackendData: async () => {
    // Authenticate the Realtime socket before opening any channel. On a restored
    // session (cold load / refresh) supabase-js fires INITIAL_SESSION, which does
    // NOT push the JWT to Realtime, so without this every RLS-protected
    // subscription below would silently receive nothing. Tolerant of failure so a
    // hiccup here never blocks hydration.
    try {
      await syncRealtimeAuth();
    } catch (e) {
      console.warn('Realtime auth sync failed; live updates may not work.', e);
    }
    const data = await backend.fetchAllData();
    set({
      workers: data.workers,
      jobs: data.jobs,
      jobcards: data.jobcards,
      crews: data.crews,
      dailyCrews: data.dailyCrews,
      assignments: data.assignments,
      logs: data.logs,
      jobPhotos: data.jobPhotos,
      jobIssues: data.jobIssues,
    });
    // Resume photo uploads that were still queued when the app last closed
    // (their files were stashed in app storage). Restored entries are this
    // worker's own — another account's queue stays parked until they sign in.
    const me0 = get().authWorker;
    if (me0) {
      const restored = await restorePendingPhotos(me0.id);
      if (restored.length) {
        set((state) => ({
          pendingPhotos: [
            ...state.pendingPhotos.filter(
              (p) => !restored.some((r) => r.id === p.id)
            ),
            ...restored,
          ],
        }));
      }
      void processPhotoQueue();
    }
    // Load this worker's notifications and open a live channel for new ones.
    // Kept separate from the bulk read (and tolerant of failure) so a missing
    // notifications migration never blocks the rest of the app from hydrating.
    const me = get().authWorker;
    if (me) {
      try {
        set({ notifications: await notificationsBackend.fetchNotifications(me.id) });
      } catch (e) {
        console.warn('Notifications load failed; none shown.', e);
      }
      notificationsBackend.subscribeNotifications(me.id, (n) =>
        get().receiveNotification(n)
      );
    }
    // Live-sync the core collections: any change another session makes streams
    // in so this session's lists (e.g. the scheduler's backlog) update without a
    // manual refresh. Debounced because one logical change can emit several row
    // events (e.g. a job plus its job_field_supers rows).
    backend.subscribeAllData(() => {
      if (dataRefreshTimer) clearTimeout(dataRefreshTimer);
      dataRefreshTimer = setTimeout(() => {
        dataRefreshTimer = null;
        get()
          .refreshBackendData()
          .catch((e) => console.warn('Realtime data refresh failed.', e));
      }, 300);
    });
  },

  refreshBackendData: async () => {
    const data = await backend.fetchAllData();
    set({
      workers: data.workers,
      jobs: data.jobs,
      jobcards: data.jobcards,
      crews: data.crews,
      dailyCrews: data.dailyCrews,
      assignments: data.assignments,
      logs: data.logs,
      jobPhotos: data.jobPhotos,
      jobIssues: data.jobIssues,
    });
  },

  clearData: () => {
    notificationsBackend.unsubscribeNotifications();
    backend.unsubscribeAllData();
    if (dataRefreshTimer) {
      clearTimeout(dataRefreshTimer);
      dataRefreshTimer = null;
    }
    if (photoRetryTimer) {
      clearTimeout(photoRetryTimer);
      photoRetryTimer = null;
    }
    set({
      workers: [],
      jobs: [],
      jobcards: [],
      crews: [],
      dailyCrews: [],
      assignments: [],
      logs: [],
      // Pending photo files/queue stay stashed on disk — they resume when
      // their owner signs back in (restorePendingPhotos filters by worker).
      jobPhotos: [],
      jobIssues: [],
      pendingPhotos: [],
      notifications: [],
      devMode: false,
      devBaseUserId: '',
      viewAsUserId: null,
      activeShift: null,
    });
  },

  updateUser: (changes) => {
    let updated: Worker | undefined;
    set((state) => {
      const me = currentWorkerOf(state);
      if (!me) return {};
      // Edit the effective identity: the real signed-in worker if that's who's
      // active, otherwise the matching mock roster row.
      if (state.authWorker && me.id === state.authWorker.id) {
        updated = { ...state.authWorker, ...changes };
        return { authWorker: updated };
      }
      return {
        workers: state.workers.map((w) => {
          if (w.id !== me.id) return w;
          updated = { ...w, ...changes };
          return updated;
        }),
      };
    });
    if (backendActive(get()) && updated) write(backend.updateWorker(updated));
  },

  addWorker: (worker) => {
    const created: Worker = {
      status: 'invited',
      ...worker,
      id: worker.id ?? `w-${nextWorkerId++}`,
    };
    set((state) => ({ workers: [...state.workers, created] }));
    return created;
  },

  updateWorker: (id, changes) => {
    let updated: Worker | undefined;
    set((state) => ({
      workers: state.workers.map((w) => {
        if (w.id !== id) return w;
        updated = { ...w, ...changes };
        return updated;
      }),
      authWorker:
        state.authWorker?.id === id
          ? { ...state.authWorker, ...changes }
          : state.authWorker,
    }));
    if (backendActive(get()) && updated) write(backend.updateWorker(updated));
  },

  removeWorker: (id) => {
    set((state) => ({ workers: state.workers.filter((w) => w.id !== id) }));
    if (backendActive(get())) write(backend.deleteWorker(id));
  },

  setWorkerRole: (id, role) => {
    let updated: Worker | undefined;
    set((state) => ({
      workers: state.workers.map((w) => {
        if (w.id !== id) return w;
        updated = { ...w, role };
        return updated;
      }),
      authWorker:
        state.authWorker?.id === id
          ? { ...state.authWorker, role }
          : state.authWorker,
    }));
    if (backendActive(get()) && updated) write(backend.updateWorkerRole(id, role));
  },

  setWorkerRate: (id, hourlyRate) => {
    let updated: Worker | undefined;
    set((state) => ({
      workers: state.workers.map((w) => {
        if (w.id !== id) return w;
        updated = { ...w, hourlyRate };
        return updated;
      }),
      authWorker:
        state.authWorker?.id === id
          ? { ...state.authWorker, hourlyRate }
          : state.authWorker,
    }));
    if (backendActive(get()) && updated) write(backend.updateWorkerRate(id, hourlyRate));
  },

  addJob: (job) => {
    const isBackend = backendActive(get());
    const created: Job = {
      status: 'Active',
      ...job,
      id: job.id ?? (isBackend ? uuid() : `job-${nextJobId++}`),
    };
    set((state) => ({ jobs: [created, ...state.jobs] }));
    // insertJob writes both the job row and its Field Super assignments
    // (job_field_supers).
    if (isBackend) write(backend.insertJob(created));
    return created;
  },

  updateJob: (id, changes) => {
    let updated: Job | undefined;
    set((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.id !== id) return job;
        updated = { ...job, ...changes };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) {
      // Job-column edits go to the jobs table. The Field-Super-assignment join
      // table is a separate, operator-only write, so only touch it when
      // fieldSuperIds is actually part of this edit — a Field Super saving
      // flashing material must not hit job_field_supers (they have no write
      // grant there).
      write(backend.updateJob(updated));
      if ('fieldSuperIds' in changes) {
        write(backend.setJobFieldSupers(id, updated.fieldSuperIds ?? []));
      }
    }
  },

  removeJob: (id) => {
    set((state) => {
      // Cascade locally the way the DB does: drop child jobcards, then any
      // schedule assignments pointing at those (now-orphaned) cards.
      const orphanedCardIds = new Set(
        state.jobcards.filter((c) => c.jobId === id).map((c) => c.id)
      );
      return {
        jobs: state.jobs.filter((job) => job.id !== id),
        jobcards: state.jobcards.filter((c) => c.jobId !== id),
        assignments: state.assignments.filter(
          (a) => !orphanedCardIds.has(a.jobcardId)
        ),
      };
    });
    // The DB cascade handles jobcards/assignments server-side; we only fire the
    // job delete.
    if (backendActive(get())) write(backend.deleteJob(id));
  },

  addJobcard: (card) => {
    const state = get();
    // Default the card's flashing material to the parent Job's value, snapshotted
    // at creation time (a later Job edit must not mutate existing cards). The
    // Field Super may pass an explicit override, which wins over the inherited value.
    const parentJob = card.jobId
      ? state.jobs.find((job) => job.id === card.jobId)
      : undefined;
    // Default the intra-day sort key to one past the busiest card on that date.
    const maxOrderOnDate = state.jobcards
      .filter((c) => c.date === card.date)
      .reduce((max, c) => Math.max(max, c.priorityOrder), 0);
    const isBackend = backendActive(state);
    const created: Jobcard = {
      ...card,
      id: card.id ?? (isBackend ? uuid() : `jc-${nextJobcardId++}`),
      status: card.status ?? 'Untouched',
      priority: card.priority ?? 'Medium',
      priorityOrder: card.priorityOrder ?? maxOrderOnDate + 1,
      flashingMaterial:
        card.flashingMaterial !== undefined
          ? card.flashingMaterial
          : parentJob?.flashingMaterial,
      // The DB stamps its own created_at on insert; this local stamp keeps the
      // in-memory card (and offline mode) consistent until the next refetch.
      createdAt: card.createdAt ?? new Date().toISOString(),
    };
    set({ jobcards: [created, ...state.jobcards] });
    if (isBackend) write(backend.insertJobcard(created));
    // A brand-new "Now" card pings the schedulers right away.
    if (created.priority === 'Now') notifyNowJobcard(get, created);
    return created;
  },

  updateJobcard: (id, changes) => {
    const before = get().jobcards.find((c) => c.id === id);
    let updated: Jobcard | undefined;
    let wasNow = false;
    set((state) => ({
      jobcards: state.jobcards.map((card) => {
        if (card.id !== id) return card;
        wasNow = card.priority === 'Now';
        updated = { ...card, ...changes };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobcard(updated));
    // Ping only on the transition INTO "Now" — re-saving an already-"Now" card
    // (or any other edit) must not re-notify.
    if (updated && updated.priority === 'Now' && !wasNow) {
      notifyNowJobcard(get, updated);
    }
    // Ping installers who have this card on TODAY's board about the edit. A
    // priority change takes precedence over a generic content edit so we send
    // one clear message, not two. (Nothing fires if it's on nobody's board today.)
    if (before && updated) {
      const audience = todaysInstallerAudienceForCard(get(), id);
      if (audience.length > 0) {
        const priorityChanged =
          'priority' in changes && before.priority !== updated.priority;
        const contentChanged = INSTALLER_VISIBLE_FIELDS.some(
          (k) =>
            k in changes &&
            JSON.stringify(before[k]) !== JSON.stringify(updated![k])
        );
        if (priorityChanged) {
          notifyScheduleChange(
            get,
            audience,
            updated,
            `has changed priority to ${updated.priority}`
          );
        } else if (contentChanged) {
          notifyScheduleChange(get, audience, updated, 'has been updated');
        }
      }
    }
  },

  deleteJobcard: (id) => {
    set((state) => ({
      // Mirror the DB cascade locally: drop the card, then any schedule
      // assignments that pointed at it.
      jobcards: state.jobcards.filter((card) => card.id !== id),
      assignments: state.assignments.filter((a) => a.jobcardId !== id),
    }));
    // The DB cascades assignments server-side; we only fire the card delete.
    if (backendActive(get())) write(backend.deleteJobcard(id));
  },

  updateJobcardNotes: (id, fieldNotes) => {
    let updated: Jobcard | undefined;
    set((state) => ({
      jobcards: state.jobcards.map((card) => {
        if (card.id !== id) return card;
        updated = { ...card, fieldNotes };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobcard(updated));
  },

  setJobcardStatus: (jobcardId, status) => {
    let updated: Jobcard | undefined;
    set((state) => ({
      jobcards: state.jobcards.map((card) => {
        if (card.id !== jobcardId) return card;
        updated = { ...card, status };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobcard(updated));
  },

  setJobcardTaskDone: (jobcardId, taskId, done) => {
    const me = currentWorkerOf(get());
    let updated: Jobcard | undefined;
    set((state) => ({
      jobcards: state.jobcards.map((card) => {
        if (card.id !== jobcardId || !card.tasks) return card;
        updated = {
          ...card,
          tasks: card.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  done,
                  doneById: done ? me?.id : undefined,
                  doneAt: done ? new Date().toISOString() : undefined,
                }
              : task
          ),
        };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobcard(updated));
  },

  addCrew: (crew) => {
    const state = get();
    const isBackend = backendActive(state);
    const created: Crew = {
      ...crew,
      id: crew.id ?? (isBackend ? uuid() : `crew-${nextCrewId++}`),
      installerIds: onlyInstallerIds(state.workers, crew.installerIds),
    };
    set({ crews: [...state.crews, created] });
    if (isBackend) write(backend.insertCrew(created));
    return created;
  },

  updateCrew: (id, changes) => {
    let updated: Crew | undefined;
    set((state) => ({
      crews: state.crews.map((crew) => {
        if (crew.id !== id) return crew;
        updated = {
          ...crew,
          ...changes,
          installerIds: changes.installerIds
            ? onlyInstallerIds(state.workers, changes.installerIds)
            : crew.installerIds,
        };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateCrew(updated));
  },

  removeCrew: (id) => {
    set((state) => ({ crews: state.crews.filter((crew) => crew.id !== id) }));
    if (backendActive(get())) write(backend.deleteCrew(id));
  },

  addDailyCrew: (crew) => {
    const state = get();
    const isBackend = backendActive(state);
    const created: DailyCrew = {
      ...crew,
      id: crew.id ?? (isBackend ? uuid() : `dc-${nextDailyCrewId++}`),
      installerIds: onlyInstallerIds(state.workers, crew.installerIds),
    };
    set({ dailyCrews: [...state.dailyCrews, created] });
    if (isBackend) write(backend.insertDailyCrew(created));
    return created;
  },

  updateDailyCrew: (id, changes) => {
    let updated: DailyCrew | undefined;
    set((state) => ({
      dailyCrews: state.dailyCrews.map((crew) => {
        if (crew.id !== id) return crew;
        updated = {
          ...crew,
          ...changes,
          installerIds: changes.installerIds
            ? onlyInstallerIds(state.workers, changes.installerIds)
            : crew.installerIds,
        };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateDailyCrew(updated));
  },

  removeDailyCrew: (id) => {
    set((state) => ({
      dailyCrews: state.dailyCrews.filter((crew) => crew.id !== id),
    }));
    if (backendActive(get())) write(backend.deleteDailyCrew(id));
  },

  assignJobcard: (jobcardId, crewId, date) => {
    const state = get();
    // Idempotent: a repeated drop of the same card onto the same crew/date must
    // not create a duplicate — keep the source of truth single.
    const existing = state.assignments.find(
      (a) => a.jobcardId === jobcardId && a.crewId === crewId && a.date === date
    );
    if (existing) return existing;
    const isBackend = backendActive(state);
    const created: ScheduleAssignment = {
      id: isBackend ? uuid() : `asn-${nextAssignmentId++}`,
      jobcardId,
      crewId,
      date,
    };
    set({ assignments: [...state.assignments, created] });
    if (isBackend) write(backend.insertAssignment(created));
    // A card joining TODAY's board pings that crew's installers. A future-dated
    // assignment is silent (only same-day changes notify).
    if (date === todayStr()) {
      const card = state.jobcards.find((c) => c.id === jobcardId);
      if (card) {
        notifyScheduleChange(
          get,
          installersOnActiveCrewForDate(state, crewId, date),
          card,
          'has been added to your calendar today'
        );
      }
    }
    return created;
  },

  unassignJobcard: (assignmentId) => {
    const state = get();
    const removed = state.assignments.find((a) => a.id === assignmentId);
    set({
      assignments: state.assignments.filter((a) => a.id !== assignmentId),
    });
    if (backendActive(state)) write(backend.deleteAssignment(assignmentId));
    // Removing a card from TODAY's board pings the affected installers. Resolve
    // the audience against pre-removal state (the assignment still exists there).
    if (removed && removed.date === todayStr()) {
      const card = state.jobcards.find((c) => c.id === removed.jobcardId);
      if (card) {
        notifyScheduleChange(
          get,
          installersOnActiveCrewForDate(state, removed.crewId, removed.date),
          card,
          'has been taken off your calendar today'
        );
      }
    }
  },

  clockIn: (ref) =>
    set({
      activeShift: { ...ref, startTime: new Date().toISOString() },
    }),

  clockOut: () => {
    const state = get();
    if (!state.activeShift) return null;
    const me = currentWorkerOf(state);
    if (!me) return null;
    const end = new Date();
    const totalHours = hoursBetween(
      state.activeShift.startTime,
      end.toISOString()
    );
    const isBackend = backendActive(state);
    const log: TimesheetLog = {
      id: isBackend ? uuid() : `t-${nextLogId++}`,
      workerId: me.id,
      date: format(new Date(state.activeShift.startTime), 'yyyy-MM-dd'),
      jobcardId: state.activeShift.jobcardId,
      customProjectName: state.activeShift.customProjectName,
      startTime: state.activeShift.startTime,
      endTime: end.toISOString(),
      totalHours,
      earnedAmount: Math.round(totalHours * me.hourlyRate * 100) / 100,
      sendStatus: 'unsent',
    };
    set({ activeShift: null, logs: [log, ...state.logs] });
    if (isBackend) write(backend.insertTimesheet(log));
    return log;
  },

  updateShiftStart: (startTime) =>
    set((state) =>
      state.activeShift
        ? { activeShift: { ...state.activeShift, startTime } }
        : {}
    ),

  updateShiftProject: (ref) =>
    set((state) =>
      state.activeShift
        ? {
            activeShift: {
              ...state.activeShift,
              jobcardId: ref.jobcardId,
              customProjectName: ref.customProjectName,
            },
          }
        : {}
    ),

  updateLog: (logId, changes) => {
    let updatedLog: TimesheetLog | undefined;
    set((state) => {
      // An edited log needs re-pushing: drop it back to unsynced, but keep the
      // QBT timesheet id so the sync layer can update in place rather than
      // create a duplicate.
      const existing = state.qbt.sync[logId];
      const sync =
        existing && existing.status !== 'unsynced'
          ? {
              ...state.qbt.sync,
              [logId]: {
                ...existing,
                status: 'unsynced' as const,
                error: undefined,
              },
            }
          : state.qbt.sync;
      return {
        qbt: { ...state.qbt, sync },
        logs: state.logs.map((log) => {
          if (log.id !== logId) return log;
          const updated = { ...log, ...changes };
          updated.totalHours = hoursBetween(updated.startTime, updated.endTime);
          updated.earnedAmount =
            Math.round(
              updated.totalHours *
                rateForWorker(state.workers, updated.workerId) *
                100
            ) / 100;
          // An edit invalidates any prior delivery — re-send on the next sweep.
          updated.sendStatus = 'unsent';
          updatedLog = updated;
          return updated;
        }),
      };
    });
    if (backendActive(get()) && updatedLog) write(backend.updateTimesheet(updatedLog));
  },

  deleteLog: (logId) => {
    set((state) => {
      const sync = { ...state.qbt.sync };
      delete sync[logId];
      return {
        logs: state.logs.filter((log) => log.id !== logId),
        qbt: { ...state.qbt, sync },
      };
    });
    if (backendActive(get())) write(backend.deleteTimesheet(logId));
  },

  addLog: (entry) => {
    const state = get();
    const me = currentWorkerOf(state);
    if (!me) throw new Error('Cannot add a log without an active worker.');
    const isBackend = backendActive(state);
    const totalHours = hoursBetween(entry.startTime, entry.endTime);
    const log: TimesheetLog = {
      id: isBackend ? uuid() : `t-${nextLogId++}`,
      workerId: me.id,
      date: format(new Date(entry.startTime), 'yyyy-MM-dd'),
      jobcardId: entry.jobcardId,
      customProjectName: entry.customProjectName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      totalHours,
      earnedAmount: Math.round(totalHours * me.hourlyRate * 100) / 100,
      sendStatus: 'unsent',
    };
    set({ logs: [log, ...state.logs] });
    if (isBackend) write(backend.insertTimesheet(log));
    return log;
  },

  addJobPhotos: async (input) => {
    const state = get();
    const me = currentWorkerOf(state);
    if (!me) return [];
    const createdIds: string[] = [];
    const isBackend = backendActive(state);
    for (const uri of input.localUris) {
      const id = uuid();
      let stashed: string;
      try {
        stashed = await stashPhotoFile(uri, id);
      } catch (e) {
        console.error('Could not stage photo file:', e);
        continue;
      }
      if (isBackend) {
        const pending: PendingJobPhoto = {
          id,
          jobId: input.jobId,
          jobcardId: input.jobcardId,
          issueId: input.issueId,
          workerId: me.id,
          localUri: stashed,
          takenAt: new Date().toISOString(),
          state: 'queued',
        };
        set((s) => ({ pendingPhotos: [pending, ...s.pendingPhotos] }));
      } else {
        // Local dev: no backend — the photo lives in memory for this session.
        const photo: JobPhoto = {
          id,
          jobId: input.jobId,
          jobcardId: input.jobcardId,
          issueId: input.issueId,
          workerId: me.id,
          storagePath: '',
          url: stashed,
          takenAt: new Date().toISOString(),
        };
        set((s) => ({ jobPhotos: [photo, ...s.jobPhotos] }));
      }
      createdIds.push(id);
    }
    if (isBackend) {
      persistPendingPhotos(get().pendingPhotos);
      void processPhotoQueue();
    }
    return createdIds;
  },

  setJobPhotoNote: (id, note) => {
    const value = note.trim() || undefined;
    if (get().pendingPhotos.some((p) => p.id === id)) {
      set((s) => ({
        pendingPhotos: s.pendingPhotos.map((p) =>
          p.id === id ? { ...p, note: value } : p
        ),
      }));
      // The note rides along when the queued photo uploads.
      persistPendingPhotos(get().pendingPhotos);
      return;
    }
    let found = false;
    set((s) => ({
      jobPhotos: s.jobPhotos.map((p) => {
        if (p.id !== id) return p;
        found = true;
        return { ...p, note: value };
      }),
    }));
    if (backendActive(get()) && found) {
      write(backend.updateJobPhotoNote(id, value));
    }
  },

  deleteJobPhoto: (id) => {
    const state = get();
    const pending = state.pendingPhotos.find((p) => p.id === id);
    if (pending) {
      // Never uploaded — just drop it from the queue and free the file. If it
      // is mid-upload, the queue notices the removal and skips the DB row.
      set((s) => ({
        pendingPhotos: s.pendingPhotos.filter((p) => p.id !== id),
      }));
      persistPendingPhotos(get().pendingPhotos);
      void discardPhotoFile(pending.localUri);
      return;
    }
    const photo = state.jobPhotos.find((p) => p.id === id);
    if (!photo) return;
    set((s) => ({ jobPhotos: s.jobPhotos.filter((p) => p.id !== id) }));
    if (backendActive(state) && photo.storagePath) {
      write(backend.deleteJobPhoto(id, photo.storagePath));
    }
  },

  retryPhotoUploads: () => {
    set((s) => ({
      pendingPhotos: s.pendingPhotos.map((p) =>
        p.state === 'failed' ? { ...p, state: 'queued' } : p
      ),
    }));
    void processPhotoQueue();
  },

  setJobFlashingPhoto: async (jobId, localUri) => {
    const state = get();
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return false;
    if (!backendActive(state)) {
      // Local dev: the compressed local uri renders directly this session.
      get().updateJob(jobId, { flashingPhotoUrl: localUri });
      return true;
    }
    const storagePath = `${jobId}/flashing-${uuid()}.jpg`;
    try {
      await backend.uploadJobPhoto(localUri, storagePath);
    } catch (e) {
      console.error('Flashing photo upload failed:', e);
      get().flash('Photo upload failed — check your signal and retry', 'warning');
      return false;
    }
    const previousPath = job.flashingPhotoPath;
    // updateJob persists the new path on the jobs row (and updates local state).
    get().updateJob(jobId, {
      flashingPhotoPath: storagePath,
      flashingPhotoUrl: backend.jobPhotoUrl(storagePath),
    });
    // The replaced object is unreferenced now — clean it up best-effort.
    if (previousPath) void backend.removePhotoObject(previousPath);
    return true;
  },

  addJobIssue: (input) => {
    const state = get();
    const me = currentWorkerOf(state);
    if (!me) return null;
    const isBackend = backendActive(state);
    const created: JobIssue = {
      id: isBackend ? uuid() : `iss-${nextIssueId++}`,
      jobId: input.jobId,
      jobcardId: input.jobcardId,
      taskId: input.taskId,
      workerId: me.id,
      description: '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    set({ jobIssues: [created, ...state.jobIssues] });
    if (isBackend) write(backend.insertJobIssue(created));
    return created;
  },

  updateJobIssueDescription: (id, description) => {
    let updated: JobIssue | undefined;
    set((state) => ({
      jobIssues: state.jobIssues.map((issue) => {
        if (issue.id !== id) return issue;
        updated = { ...issue, description };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobIssue(updated));
  },

  setJobIssueResolved: (id, resolved) => {
    const me = currentWorkerOf(get());
    let updated: JobIssue | undefined;
    set((state) => ({
      jobIssues: state.jobIssues.map((issue) => {
        if (issue.id !== id) return issue;
        updated = resolved
          ? {
              ...issue,
              status: 'resolved',
              resolvedById: me?.id,
              resolvedAt: new Date().toISOString(),
            }
          : {
              ...issue,
              status: 'open',
              resolvedById: undefined,
              resolvedAt: undefined,
            };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobIssue(updated));
  },

  deleteJobIssue: (id) => {
    set((state) => ({
      jobIssues: state.jobIssues.filter((issue) => issue.id !== id),
      // Mirror the DB's `on delete set null`: the issue's photos live on as
      // plain job photos.
      jobPhotos: state.jobPhotos.map((p) =>
        p.issueId === id ? { ...p, issueId: undefined } : p
      ),
      pendingPhotos: state.pendingPhotos.map((p) =>
        p.issueId === id ? { ...p, issueId: undefined } : p
      ),
    }));
    // Keep the persisted queue in step so a restarted upload can't reference
    // the deleted issue.
    persistPendingPhotos(get().pendingPhotos);
    if (backendActive(get())) write(backend.deleteJobIssue(id));
  },

  markTimesheetsSent: () => {
    set((state) => ({
      // The weekly server sweep delivered these to QuickBooks Time. (A real
      // per-log failure path sets 'failed'; that happens server-side in Step 7.)
      logs: state.logs.map((log) =>
        log.sendStatus === 'sent' ? log : { ...log, sendStatus: 'sent' }
      ),
    }));
    if (backendActive(get())) write(backend.markTimesheetsSentRemote());
  },

  pushNotification: (input) => {
    const state = get();
    const createdAt = new Date().toISOString();
    if (backendActive(state)) {
      // One row per recipient; realtime fans each out to its owner's session.
      for (const recipientId of input.recipientIds) {
        write(
          notificationsBackend.insertNotification({
            id: uuid(),
            recipientId,
            type: input.type,
            title: input.title,
            body: input.body,
            data: input.data,
            read: false,
            createdAt,
          })
        );
      }
      return;
    }
    // Local/dev: there is no per-session delivery, so every recipient's
    // notification is held in the one in-memory list; the UI filters by viewer.
    const created: AppNotification[] = input.recipientIds.map((recipientId) => ({
      id: `ntf-${nextNotificationId++}`,
      recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      read: false,
      createdAt,
    }));
    set({ notifications: [...created, ...state.notifications] });
  },

  receiveNotification: (notification) =>
    set((state) =>
      state.notifications.some((n) => n.id === notification.id)
        ? {}
        : { notifications: [notification, ...state.notifications] }
    ),

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    if (backendActive(get())) write(notificationsBackend.markNotificationRead(id));
  },

  markAllNotificationsRead: () => {
    const me = currentWorkerOf(get());
    if (!me) return;
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.recipientId === me.id && !n.read ? { ...n, read: true } : n
      ),
    }));
    if (backendActive(get())) {
      write(notificationsBackend.markAllNotificationsRead(me.id));
    }
  },

  setQbtConfig: (changes) =>
    set((state) => ({
      qbt: { ...state.qbt, config: { ...state.qbt.config, ...changes } },
    })),

  setQbtConnection: (connection) =>
    set((state) => ({ qbt: { ...state.qbt, connection } })),

  setQbtJobcodes: (jobcodes) =>
    set((state) => ({ qbt: { ...state.qbt, jobcodes } })),

  setQbtJobcodeMapping: (key, jobcodeId) =>
    set((state) => {
      const jobcodeMap = { ...state.qbt.jobcodeMap };
      if (jobcodeId === undefined) delete jobcodeMap[key];
      else jobcodeMap[key] = jobcodeId;
      return { qbt: { ...state.qbt, jobcodeMap } };
    }),

  setQbtDefaultJobcode: (jobcodeId) =>
    set((state) => ({ qbt: { ...state.qbt, defaultJobcodeId: jobcodeId } })),

  setQbtSyncRecord: (logId, record) =>
    set((state) => ({
      qbt: { ...state.qbt, sync: { ...state.qbt.sync, [logId]: record } },
    })),

  setQbtApprovalWindow: (submittedThrough, approvedThrough) =>
    set((state) => ({
      qbt: { ...state.qbt, submittedThrough, approvedThrough },
    })),
}));

// --- Job photo upload queue ---------------------------------------------------
//
// Photos upload one at a time in the background: bytes to the storage bucket,
// then the metadata row. Any failure (usually no signal on site) parks the
// queue and a timer retries every 30s until everything lands. Queue entries are
// mirrored to AsyncStorage (files are already stashed in app storage — see
// lib/photoFiles) so an app restart resumes instead of losing photos.

const PENDING_PHOTOS_KEY = 'oxwh.pendingJobPhotos';
const PHOTO_RETRY_MS = 30_000;

let photoQueueRunning = false;
let photoRetryTimer: ReturnType<typeof setTimeout> | null = null;

/** Mirror the queue to AsyncStorage. Web is skipped — blob uris die with the page. */
function persistPendingPhotos(pending: PendingJobPhoto[]): void {
  if (Platform.OS === 'web') return;
  AsyncStorage.setItem(PENDING_PHOTOS_KEY, JSON.stringify(pending)).catch(
    () => {}
  );
}

/**
 * Load the persisted queue for `workerId`. Only their own entries return (an
 * upload must run as the photo's owner to pass RLS); anything mid-flight when
 * the app died goes back to 'queued'.
 */
async function restorePendingPhotos(
  workerId: string
): Promise<PendingJobPhoto[]> {
  if (Platform.OS === 'web') return [];
  try {
    const raw = await AsyncStorage.getItem(PENDING_PHOTOS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as PendingJobPhoto[])
      .filter((p) => p.workerId === workerId)
      .map((p) => ({ ...p, state: 'queued' as const }));
  } catch {
    return [];
  }
}

function schedulePhotoRetry(): void {
  if (photoRetryTimer) return;
  photoRetryTimer = setTimeout(() => {
    photoRetryTimer = null;
    useAppStore.getState().retryPhotoUploads();
  }, PHOTO_RETRY_MS);
}

async function processPhotoQueue(): Promise<void> {
  if (photoQueueRunning) return;
  photoQueueRunning = true;
  try {
    for (;;) {
      const state = useAppStore.getState();
      if (!backendActive(state)) return;
      const next = state.pendingPhotos.find((p) => p.state === 'queued');
      if (!next) return;
      useAppStore.setState((s) => ({
        pendingPhotos: s.pendingPhotos.map((p) =>
          p.id === next.id ? { ...p, state: 'uploading' } : p
        ),
      }));
      const storagePath = `${next.jobId}/${next.id}.jpg`;
      try {
        await backend.uploadJobPhoto(next.localUri, storagePath);
        // The photo may have been deleted from the queue mid-upload — then the
        // metadata row is skipped and the orphaned object is left behind
        // (harmless: nothing references it).
        const current = useAppStore
          .getState()
          .pendingPhotos.find((p) => p.id === next.id);
        if (!current) continue;
        const photo: JobPhoto = {
          id: current.id,
          jobId: current.jobId,
          jobcardId: current.jobcardId,
          issueId: current.issueId,
          workerId: current.workerId,
          storagePath,
          url: backend.jobPhotoUrl(storagePath),
          note: current.note,
          takenAt: current.takenAt,
        };
        await backend.insertJobPhoto(photo);
        useAppStore.setState((s) => ({
          pendingPhotos: s.pendingPhotos.filter((p) => p.id !== photo.id),
          // Realtime may have already streamed the row in — don't double-add.
          jobPhotos: s.jobPhotos.some((existing) => existing.id === photo.id)
            ? s.jobPhotos
            : [photo, ...s.jobPhotos],
        }));
        persistPendingPhotos(useAppStore.getState().pendingPhotos);
        useAppStore.getState().signalSaved();
        void discardPhotoFile(current.localUri);
      } catch (e) {
        console.error('Job photo upload failed; retrying shortly:', e);
        useAppStore.setState((s) => ({
          pendingPhotos: s.pendingPhotos.map((p) =>
            p.id === next.id ? { ...p, state: 'failed' } : p
          ),
        }));
        persistPendingPhotos(useAppStore.getState().pendingPhotos);
        schedulePhotoRetry();
        return;
      }
    }
  } finally {
    photoQueueRunning = false;
  }
}

/** The identity-resolving slice of state (shared by the selectors below). */
type IdentityState = {
  workers: Worker[];
  devBaseUserId: string;
  authWorker: Worker | null;
  viewAsUserId: string | null;
  devMode: boolean;
};

/**
 * The real signed-in identity: the Supabase auth worker if present, otherwise
 * (local dev mode only) the dev base (the Developer). Returns null when there is
 * no identity at all — i.e. signed out — which routes the UI to the login gate.
 */
export function baseWorkerOf(state: IdentityState): Worker | null {
  if (state.authWorker) return state.authWorker;
  if (state.devMode) {
    return state.workers.find((w) => w.id === state.devBaseUserId) ?? null;
  }
  return null;
}

/**
 * The identity the UI renders as, or null when signed out. Only the Developer
 * can impersonate: when the base role is `developer` and a `viewAsUserId` is
 * set, that worker is returned; for everyone else it's simply themselves.
 */
export function currentWorkerOf(state: IdentityState): Worker | null {
  const base = baseWorkerOf(state);
  if (!base) return null;
  if (base.role === 'developer' && state.viewAsUserId) {
    return state.workers.find((w) => w.id === state.viewAsUserId) ?? base;
  }
  return base;
}

/**
 * The crew id an installer is working under on `date`: a Daily Crew they're in
 * that day wins; otherwise their Permanent Crew. Returns null if they're on no
 * crew that day.
 *
 * Edge case (intentional): if an installer is pulled into a Daily Crew on a date,
 * they see that Daily Crew's assignments INSTEAD OF their Permanent Crew's that
 * day. This is what prevents double-booking.
 */
export function activeCrewIdFor(
  state: { crews: Crew[]; dailyCrews: DailyCrew[] },
  installerId: string,
  date: string
): string | null {
  const daily = state.dailyCrews.find(
    (dc) => dc.date === date && dc.installerIds.includes(installerId)
  );
  if (daily) return daily.id;
  const permanent = state.crews.find((c) => c.installerIds.includes(installerId));
  if (permanent) return permanent.id;
  return null;
}

/**
 * The jobs a Field Super may see: only those they're assigned to via
 * {@link Job.fieldSuperIds}. A job with no Field Supers is visible to nobody.
 * Used by both Field Super screens so "own jobs only" (and, transitively, "own
 * jobcards only") is enforced in one place.
 */
export function jobsForFieldSuper(jobs: Job[], fieldSuperId: string): Job[] {
  return jobs.filter((job) => job.fieldSuperIds?.includes(fieldSuperId));
}

/** Jobcard ids assigned to a given crew on a given date. */
export function jobcardIdsForCrewOnDate(
  state: { assignments: ScheduleAssignment[] },
  crewId: string,
  date: string
): string[] {
  return state.assignments
    .filter((a) => a.crewId === crewId && a.date === date)
    .map((a) => a.jobcardId);
}

/**
 * Convenience: the Jobcards an installer should see on `date` = assignments to
 * their active crew that day.
 */
export function jobcardsForInstallerOnDate(
  state: {
    crews: Crew[];
    dailyCrews: DailyCrew[];
    assignments: ScheduleAssignment[];
    jobcards: Jobcard[];
  },
  installerId: string,
  date: string
): Jobcard[] {
  const crewId = activeCrewIdFor(state, installerId, date);
  if (!crewId) return [];
  const ids = jobcardIdsForCrewOnDate(state, crewId, date);
  return state.jobcards.filter((card) => ids.includes(card.id));
}

/**
 * All dates (yyyy-MM-dd) on which an installer's ACTIVE crew has an assignment —
 * used to mark days on the week ribbon. Respects the Daily-overrides-Permanent
 * rule per date: an assignment counts only if its crew is the installer's active
 * crew for that assignment's own date.
 */
export function assignedDatesForInstaller(
  state: {
    crews: Crew[];
    dailyCrews: DailyCrew[];
    assignments: ScheduleAssignment[];
  },
  installerId: string
): Set<string> {
  const dates = new Set<string>();
  for (const a of state.assignments) {
    if (activeCrewIdFor(state, installerId, a.date) === a.crewId) {
      dates.add(a.date);
    }
  }
  return dates;
}

/**
 * The distinct parent Jobs a worker has clocked into, most recent first (the
 * currently running shift counts as most recent of all). Clock-ins reference
 * jobcards, so each log resolves jobcard → parent job; custom-project logs (no
 * jobcard) can't resolve to a job and are skipped.
 */
export function recentClockedJobs(
  state: {
    logs: TimesheetLog[];
    jobcards: Jobcard[];
    jobs: Job[];
    activeShift: ActiveShift | null;
  },
  workerId: string,
  limit = 10
): Job[] {
  const jobcardIds: string[] = [];
  if (state.activeShift?.jobcardId) {
    jobcardIds.push(state.activeShift.jobcardId);
  }
  const logs = state.logs
    .filter((l) => l.workerId === workerId && l.jobcardId)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  for (const log of logs) jobcardIds.push(log.jobcardId!);

  const result: Job[] = [];
  const seen = new Set<string>();
  for (const cardId of jobcardIds) {
    if (result.length >= limit) break;
    const jobId = state.jobcards.find((c) => c.id === cardId)?.jobId;
    if (!jobId || seen.has(jobId)) continue;
    seen.add(jobId);
    const job = state.jobs.find((j) => j.id === jobId);
    if (job) result.push(job);
  }
  return result;
}

/** Hook: the effective worker (impersonated for the Developer, else self), or null when signed out. */
export function useCurrentWorker(): Worker | null {
  return useAppStore((s) => currentWorkerOf(s));
}

/** Hook: the effective role, or null when signed out — handy for routing/gating. */
export function useCurrentRole(): AppRole | null {
  return useAppStore((s) => currentWorkerOf(s)?.role ?? null);
}

/** Hook: true when the real (base) identity is the Developer — gates the switcher. */
export function useIsDeveloper(): boolean {
  return useAppStore((s) => baseWorkerOf(s)?.role === 'developer');
}

/**
 * Hook: the current (effective) worker's notifications, newest first. Memoized
 * so the filtered array stays referentially stable until the inputs change.
 */
export function useMyNotifications(): AppNotification[] {
  const notifications = useAppStore((s) => s.notifications);
  const me = useCurrentWorker();
  return useMemo(
    () => (me ? notifications.filter((n) => n.recipientId === me.id) : []),
    [notifications, me]
  );
}

/** Hook: how many of the current worker's notifications are unread. */
export function useUnreadNotificationCount(): number {
  const mine = useMyNotifications();
  return useMemo(() => mine.filter((n) => !n.read).length, [mine]);
}
