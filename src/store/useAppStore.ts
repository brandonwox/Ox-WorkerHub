import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parse } from 'date-fns';
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
import {
  discardPhotoFile,
  MAX_UPLOAD_BYTES,
  mediaFileSize,
  stashPhotoFile,
} from '@/lib/photoFiles';
import {
  loadDataCache,
  persistDataCache,
  prefetchFlashingPhotos,
} from '@/store/offlineCache';
import { setThemeScheme, ThemeScheme } from '@/theme';
import {
  ActiveShift,
  AppNotification,
  AppRole,
  Crew,
  DailyCrew,
  Job,
  WorkRequest,
  WorkRequestStatus,
  JobDocument,
  JobDocumentKind,
  JobDocumentType,
  JobIssue,
  JobPhoto,
  JobPhotoType,
  JobScope,
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
import { jobDisplayNameById } from '@/utils/jobName';
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
 * Every crew list in the app stays alphabetical — the DB fetch has no ORDER BY
 * (arbitrary order was why lists "got unorganized"), so the store sorts at
 * every point crews enter state. This also makes the automatic palette color
 * (keyed by list position) stable.
 */
function sortCrews(list: Crew[]): Crew[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}
function sortDailyCrews(list: DailyCrew[]): DailyCrew[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
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
 * Ping every scheduler that a work request is now top priority. Called from the
 * work request create/edit actions whenever a card's priority becomes "Now".
 */
function notifyNowWorkRequest(get: () => AppState, card: WorkRequest): void {
  const state = get();
  const recipients = schedulerIds(state.workers);
  if (recipients.length === 0) return;
  // Body: "Priority: Now" — the notification renderers color the "Now" red.
  get().pushNotification({
    recipientIds: recipients,
    type: 'work_request_now',
    title: workRequestNotificationTitle(state, card.jobId, card.title),
    body: 'Priority: Now',
    data: { workRequestId: card.id },
  });
}

/** Ids of every worker holding `role`. */
function idsWithRole(workers: Worker[], role: AppRole): string[] {
  return workers.filter((w) => w.role === role).map((w) => w.id);
}

/** The Field Supers responsible for a job (sub-jobs mirror their parent's). */
function jobFieldSuperIds(
  state: { jobs: Job[] },
  jobId: string | undefined
): string[] {
  if (!jobId) return [];
  return state.jobs.find((j) => j.id === jobId)?.fieldSuperIds ?? [];
}

/**
 * The office audience for a field event on a work request: every scheduler plus
 * the card's job's Field Supers, minus the worker who caused the event (nobody
 * needs a ping about their own action).
 */
function officeAudienceForCard(
  state: { workers: Worker[]; jobs: Job[] },
  card: WorkRequest,
  exceptId: string | undefined
): string[] {
  const ids = new Set([
    ...idsWithRole(state.workers, 'scheduler'),
    ...jobFieldSuperIds(state, card.jobId),
  ]);
  if (exceptId) ids.delete(exceptId);
  return [...ids];
}

/**
 * "PO · <name>" notification title for work-request notifications (the PO is
 * the office's handle for a job). Falls back to the job's display name when
 * the job has no PO, and to `name` alone on a standalone request.
 */
function workRequestNotificationTitle(
  state: { jobs: Job[] },
  jobId: string | undefined,
  name: string
): string {
  const job = jobId ? state.jobs.find((j) => j.id === jobId) : undefined;
  const label =
    job?.po?.trim() || (jobId ? jobDisplayNameById(jobId, state.jobs) : '');
  return label ? `${label} · ${name}` : name;
}

/** "PO · <job name>" title for job-level notifications (name alone when no PO). */
function jobNotificationTitle(
  state: { jobs: Job[] },
  jobId: string | undefined
): string {
  if (!jobId) return '';
  const job = state.jobs.find((j) => j.id === jobId);
  const name = jobDisplayNameById(jobId, state.jobs) || job?.name || '';
  const po = job?.po?.trim();
  return po && name ? `${po} · ${name}` : name || po || '';
}

/** Local calendar day as yyyy-MM-dd — the same key schedules/assignments use. */
function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Installers whose ACTIVE crews on `date` include `crewId` — the people who
 * actually see that crew's cards that day (Daily-crew overrides applied).
 * This is the audience for any change to `crewId`'s board on `date`.
 */
function installersOnActiveCrewForDate(
  state: {
    workers: Worker[];
    crews: Crew[];
    dailyCrews: DailyCrew[];
    assignments: ScheduleAssignment[];
  },
  crewId: string,
  date: string
): string[] {
  return state.workers
    .filter(
      (w) =>
        w.role === 'installer' &&
        activeCrewIdsFor(state, w.id, date).includes(crewId)
    )
    .map((w) => w.id);
}

/**
 * Installers who have `workRequestId` on TODAY's board — the union of the audiences
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
  workRequestId: string
): string[] {
  const today = todayStr();
  const crewIds = new Set(
    state.assignments
      .filter((a) => a.workRequestId === workRequestId && a.date === today)
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
 * Ping each installer whose today-schedule changed. `detail` is the whole
 * body — one short clause (e.g. "Taken off your calendar today"); the title
 * identifies the card ("PO · name"). A no-op when nobody is affected. Callers
 * gate on the change being for TODAY — a change to any other day is
 * intentionally silent.
 */
function notifyScheduleChange(
  get: () => AppState,
  installerIds: string[],
  card: WorkRequest,
  detail: string
): void {
  if (installerIds.length === 0) return;
  get().pushNotification({
    recipientIds: installerIds,
    type: 'schedule_change',
    title: workRequestNotificationTitle(get(), card.jobId, card.title),
    body: detail,
    data: { workRequestId: card.id },
  });
}

/**
 * Who gets the "status needs updating" ping for a crew: a permanent
 * crew's own foreman. A daily crew has no foreman of its own, so any of its
 * members who is a permanent-crew foreman stands in.
 */
function foremenForCrew(
  state: { crews: Crew[]; dailyCrews: DailyCrew[] },
  crewId: string
): string[] {
  const permanent = state.crews.find((c) => c.id === crewId);
  if (permanent) return permanent.foremanId ? [permanent.foremanId] : [];
  const daily = state.dailyCrews.find((dc) => dc.id === crewId);
  if (!daily) return [];
  const foremanIds = new Set(
    state.crews.map((c) => c.foremanId).filter((id): id is string => !!id)
  );
  return daily.installerIds.filter((id) => foremanIds.has(id));
}

/** Work Request fields an installer sees on their card — an edit to any pings "updated". */
const INSTALLER_VISIBLE_FIELDS: (keyof WorkRequest)[] = [
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

// ---------------------------------------------------------------------------
// Durable write outbox — every change is device-first.
//
// A mutation updates local state instantly, is appended to a persistent queue
// (AsyncStorage), and a single background flusher replays the queue to Supabase
// in order. No signal on site just parks the queue — a timer retries every 30s
// and the queue survives app restarts — so a field change is never lost to a
// dead spot or a force-quit. (Photos have their own parallel queue because they
// carry image files; see the photo upload queue further down.)
// ---------------------------------------------------------------------------

// Writes the flusher is actively pushing right now. While any are in flight a
// realtime refetch is deferred (refreshDeferred re-arms it when they settle) —
// the refetch would return a snapshot predating them and briefly revert the
// optimistic local change.
let writesInFlight = 0;
let refreshDeferred = false;

// Per-row queued-write guards (id → refcount): refetch merges keep the LOCAL
// version of these rows so a stale snapshot can't revert them while their
// writes are still queued or traveling.
const pendingIssueUpserts = new Map<string, number>();
const pendingIssueDeletes = new Map<string, number>();
const pendingPhotoNotes = new Map<string, number>();
const pendingWorkRequestTaskWrites = new Map<string, number>();
const pendingDocumentInserts = new Map<string, number>();
const pendingDocumentUpdates = new Map<string, number>();
const pendingDocumentDeletes = new Map<string, number>();

const GUARD_MAPS = {
  issueUpsert: pendingIssueUpserts,
  issueDelete: pendingIssueDeletes,
  photoNote: pendingPhotoNotes,
  workRequestTasks: pendingWorkRequestTaskWrites,
  documentInsert: pendingDocumentInserts,
  documentUpdate: pendingDocumentUpdates,
  documentDelete: pendingDocumentDeletes,
} as const;

/** Which guard map a queued op holds a row in (serialized with the op). */
interface OutboxGuard {
  map: keyof typeof GUARD_MAPS;
  id: string;
}

/** One queued mutation — pure JSON so it survives an app restart. */
interface OutboxOp {
  id: string;
  kind: OutboxKind;
  payload: unknown;
  /** The author. Ops replay only while they are the signed-in worker (RLS). */
  workerId: string;
  guard?: OutboxGuard;
  queuedAt: string;
  /**
   * Skip the "Changes Saved" pill for this op. Set per-write for changes the
   * UI already confirms (a card visibly moving on a drag, a checkbox ticking)
   * or that aren't a deliberate save (inline typing commits, background
   * stamps) — see also SILENT_OUTBOX_KINDS for whole-kind silencing.
   */
  silent?: boolean;
}

let outboxOps: OutboxOp[] = [];
/** Live guard releases keyed by op id (rebuilt from op.guard on restore). */
const outboxGuardReleases = new Map<string, () => void>();
let outboxFlushing = false;
let outboxRetryTimer: ReturnType<typeof setTimeout> | null = null;

const OUTBOX_KEY_PREFIX = 'oxwh.writeOutbox.';
const OUTBOX_RETRY_MS = 30_000;

/**
 * Replay table for queued ops. Adding a new kind of backend write = add its
 * executor here and call write('<kind>', payload) from the store action.
 */
const OUTBOX_EXECUTORS = {
  updateWorker: (p: Worker) => backend.updateWorker(p),
  deleteWorker: (p: string) => backend.deleteWorker(p),
  updateWorkerRole: (p: { id: string; role: AppRole }) =>
    backend.updateWorkerRole(p.id, p.role),
  updateWorkerRate: (p: { id: string; hourlyRate: number }) =>
    backend.updateWorkerRate(p.id, p.hourlyRate),
  insertJob: (p: Job) => backend.insertJob(p),
  updateJob: (p: Job) => backend.updateJob(p),
  deleteJob: (p: string) => backend.deleteJob(p),
  setJobFieldSupers: (p: { jobId: string; fieldSuperIds: string[] }) =>
    backend.setJobFieldSupers(p.jobId, p.fieldSuperIds),
  assignJobFieldSuper: (p: { jobId: string; fieldSuperId: string }) =>
    backend.assignJobFieldSuper(p.jobId, p.fieldSuperId),
  insertWorkRequest: (p: WorkRequest) => backend.insertWorkRequest(p),
  updateWorkRequest: (p: WorkRequest) => backend.updateWorkRequest(p),
  deleteWorkRequest: (p: string) => backend.deleteWorkRequest(p),
  insertCrew: (p: Crew) => backend.insertCrew(p),
  updateCrew: (p: Crew) => backend.updateCrew(p),
  deleteCrew: (p: string) => backend.deleteCrew(p),
  insertDailyCrew: (p: DailyCrew) => backend.insertDailyCrew(p),
  updateDailyCrew: (p: DailyCrew) => backend.updateDailyCrew(p),
  deleteDailyCrew: (p: string) => backend.deleteDailyCrew(p),
  insertAssignment: (p: ScheduleAssignment) => backend.insertAssignment(p),
  deleteAssignment: (p: string) => backend.deleteAssignment(p),
  insertTimesheet: (p: TimesheetLog) => backend.insertTimesheet(p),
  updateTimesheet: (p: TimesheetLog) => backend.updateTimesheet(p),
  deleteTimesheet: (p: string) => backend.deleteTimesheet(p),
  markTimesheetsSentRemote: (_p: null) => backend.markTimesheetsSentRemote(),
  updateJobPhotoNote: (p: { id: string; note?: string }) =>
    backend.updateJobPhotoNote(p.id, p.note),
  updateJobPhotoSgd: (p: { id: string; sgdVideo: boolean }) =>
    backend.updateJobPhotoSgd(p.id, p.sgdVideo),
  updateJobPhotoType: (p: { id: string; photoType?: JobPhotoType }) =>
    backend.updateJobPhotoType(p.id, p.photoType),
  deleteJobPhoto: (p: { id: string; storagePath: string }) =>
    backend.deleteJobPhoto(p.id, p.storagePath),
  insertJobDocument: (p: JobDocument) => backend.insertJobDocument(p),
  updateJobDocumentType: (p: { id: string; docType?: JobDocumentType }) =>
    backend.updateJobDocumentType(p.id, p.docType),
  updateJobDocument: (p: {
    id: string;
    title: string;
    body?: string;
    docType?: JobDocumentType;
  }) => backend.updateJobDocument(p),
  deleteJobDocument: (p: { id: string; storagePath?: string }) =>
    backend.deleteJobDocument(p.id, p.storagePath),
  insertJobIssue: (p: JobIssue) => backend.insertJobIssue(p),
  updateJobIssue: (p: JobIssue) => backend.updateJobIssue(p),
  deleteJobIssue: (p: string) => backend.deleteJobIssue(p),
  insertNotification: (p: AppNotification) =>
    notificationsBackend.insertNotification(p),
  markNotificationRead: (p: string) =>
    notificationsBackend.markNotificationRead(p),
  markAllNotificationsRead: (p: string) =>
    notificationsBackend.markAllNotificationsRead(p),
  deleteNotification: (p: string) =>
    notificationsBackend.deleteNotification(p),
  deleteAllNotifications: (p: string) =>
    notificationsBackend.deleteAllNotifications(p),
} as const;

/**
 * Ops that are bookkeeping rather than a change the worker made. Reading a
 * notification, or the notification a work request transition fires at the
 * schedulers, must not pop "Changes Saved" — the worker didn't save anything,
 * and a pill appearing next to an unrelated failure reads as a lie.
 */
const SILENT_OUTBOX_KINDS = new Set<string>([
  'insertNotification',
  'markNotificationRead',
  'markAllNotificationsRead',
  'deleteNotification',
  'deleteAllNotifications',
  // The weekly server sweep's flag, not a change this worker made.
  'markTimesheetsSentRemote',
]);

type OutboxKind = keyof typeof OUTBOX_EXECUTORS;
type OutboxPayload<K extends OutboxKind> = Parameters<
  (typeof OUTBOX_EXECUTORS)[K]
>[0];

/** Mirror the outbox depth into store state so the sync chip can render it. */
function syncPendingWriteCount(): void {
  const count = outboxOps.length;
  if (useAppStore.getState().pendingWriteCount !== count) {
    useAppStore.setState({ pendingWriteCount: count });
  }
}

/** "insertJobIssue" → "insert job issue" for the failure notification body. */
function humanizeKind(kind: string): string {
  return kind
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
}

/**
 * Device-local "couldn't save" notification — never written to the DB (it
 * describes THIS device's sync queue). Pops the toaster and lands on the bell
 * so a rejected change is impossible to miss.
 */
function notifySaveFailed(workerId: string, what: string): void {
  useAppStore.getState().receiveNotification({
    id: uuid(),
    recipientId: workerId,
    type: 'save_failed',
    title: "A change couldn't be saved",
    body: `Your ${what} was rejected by the server and has been discarded — please redo it or contact the office.`,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Queue a Supabase mutation, device-first. The op lands in the persistent
 * outbox and the flusher pushes it (and everything queued before it) in order.
 * On success the store's `savedTick` bumps so the desktop sidebar can pop a
 * "Changes Saved" pill — backendActive gates every caller, so local dev mode
 * and the Developer never queue anything.
 *
 * `guard` registers the touched row in its guard map until the op settles, so
 * refetch merges keep the local version meanwhile.
 */
function write<K extends OutboxKind>(
  kind: K,
  payload: OutboxPayload<K>,
  guard?: OutboxGuard,
  opts?: { silent?: boolean }
): void {
  const me = useAppStore.getState().authWorker;
  const op: OutboxOp = {
    id: uuid(),
    kind,
    payload,
    workerId: me?.id ?? '',
    guard,
    queuedAt: new Date().toISOString(),
    silent: opts?.silent,
  };
  outboxOps.push(op);
  if (guard) {
    outboxGuardReleases.set(
      op.id,
      trackPending(GUARD_MAPS[guard.map], guard.id)
    );
  }
  persistOutbox();
  syncPendingWriteCount();
  void flushOutbox();
}

/**
 * Bump a per-row refcount and return the matching release. Rows in one of the
 * guard maps keep their LOCAL version during a refetch merge, so a stale
 * snapshot can't revert them while their write is still queued.
 */
function trackPending(map: Map<string, number>, id: string): () => void {
  map.set(id, (map.get(id) ?? 0) + 1);
  return () => {
    const left = (map.get(id) ?? 1) - 1;
    if (left <= 0) map.delete(id);
    else map.set(id, left);
  };
}

/** Mirror the outbox to AsyncStorage under the signed-in worker's key. */
function persistOutbox(): void {
  const me = useAppStore.getState().authWorker;
  if (!me) return;
  AsyncStorage.setItem(
    OUTBOX_KEY_PREFIX + me.id,
    JSON.stringify(outboxOps)
  ).catch(() => {});
}

/**
 * Load `workerId`'s persisted outbox (queued when the app last closed) in
 * front of anything queued this session, and re-arm each op's row guard.
 * Idempotent: ops already in memory aren't duplicated.
 */
async function restoreOutbox(workerId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY_PREFIX + workerId);
    if (!raw) return;
    const stored = (JSON.parse(raw) as OutboxOp[]).filter(
      (op) =>
        op.workerId === workerId && !outboxOps.some((q) => q.id === op.id)
    );
    if (stored.length === 0) return;
    outboxOps = [...stored, ...outboxOps];
    for (const op of stored) {
      if (op.guard) {
        outboxGuardReleases.set(
          op.id,
          trackPending(GUARD_MAPS[op.guard.map], op.guard.id)
        );
      }
    }
    syncPendingWriteCount();
  } catch {
    // Unreadable queue — nothing recoverable.
  }
}

/** Heuristic: transport failures retry; anything else is a database rejection. */
function looksLikeNetworkError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /network|fetch|timeout|timed out|socket|connection|offline/i.test(
    message
  );
}

/**
 * Was this rejection about the signed-in role simply not being allowed to make
 * the edit? Postgres reports 42501 (insufficient_privilege) both for an RLS
 * policy refusing the row and for our own role guards, which raise it
 * explicitly. Anything else — a constraint, a validity guard, a bug — is a real
 * failure the worker should be told about loudly.
 */
function looksLikePermissionError(e: unknown): boolean {
  return e instanceof backend.BackendWriteError && e.code === '42501';
}

function scheduleOutboxRetry(): void {
  if (outboxRetryTimer) return;
  outboxRetryTimer = setTimeout(() => {
    outboxRetryTimer = null;
    void flushOutbox();
  }, OUTBOX_RETRY_MS);
}

/** Drop a settled op (delivered or permanently rejected) and free its guard. */
function settleOutboxOp(op: OutboxOp): void {
  // Filter (not shift) so a sign-out reassigning `outboxOps` mid-flush can't
  // make this remove the wrong entry.
  outboxOps = outboxOps.filter((q) => q.id !== op.id);
  outboxGuardReleases.get(op.id)?.();
  outboxGuardReleases.delete(op.id);
  persistOutbox();
  syncPendingWriteCount();
}

/**
 * Push queued ops oldest-first until the queue is empty or unreachable. A
 * network failure parks the whole queue (order is preserved) and retries every
 * 30s; a database rejection (RLS, constraint) drops that op — everything
 * behind it would jam forever otherwise — with a loud console error.
 */
async function flushOutbox(): Promise<void> {
  if (outboxFlushing) return;
  outboxFlushing = true;
  writesInFlight++;
  try {
    for (;;) {
      const state = useAppStore.getState();
      const op = outboxOps[0];
      if (!op) return;
      // Ops replay as their author — parked (on disk) while anyone else, or
      // nobody, is signed in.
      if (!backendActive(state) || op.workerId !== state.authWorker?.id) {
        return;
      }
      try {
        await OUTBOX_EXECUTORS[op.kind](op.payload as never);
        if (!SILENT_OUTBOX_KINDS.has(op.kind) && !op.silent) {
          useAppStore.getState().signalSaved();
        }
      } catch (e) {
        if (looksLikeNetworkError(e)) {
          scheduleOutboxRetry();
          return;
        }
        if (looksLikePermissionError(e)) {
          // Not a malfunction — this role just isn't allowed to make that edit.
          // Stays a quiet system message; no notification, nothing on the bell.
          console.warn(
            `Supabase write refused (${op.kind}) — role lacks permission:`,
            e
          );
          useAppStore
            .getState()
            .flash(
              `You don't have permission to change that — your “${humanizeKind(
                op.kind
              )}” edit was discarded`,
              'warning'
            );
        } else {
          console.error(
            `Supabase write failed permanently (${op.kind}) — change not saved:`,
            e
          );
          notifySaveFailed(op.workerId, `“${humanizeKind(op.kind)}” change`);
        }
      }
      settleOutboxOp(op);
    }
  } finally {
    outboxFlushing = false;
    writesInFlight--;
    if (writesInFlight === 0 && refreshDeferred) {
      refreshDeferred = false;
      scheduleBackendRefresh();
    }
  }
}

/**
 * Debounced full refetch off the realtime channel. Deferred while the flusher
 * is actively writing — the refetch would race it — and re-armed when it
 * settles (whose own realtime echo also lands here).
 */
function scheduleBackendRefresh(): void {
  if (dataRefreshTimer) clearTimeout(dataRefreshTimer);
  dataRefreshTimer = setTimeout(() => {
    dataRefreshTimer = null;
    if (writesInFlight > 0) {
      refreshDeferred = true;
      return;
    }
    useAppStore
      .getState()
      .refreshBackendData()
      .catch((e) => console.warn('Realtime data refresh failed.', e));
  }, 300);
}

/**
 * RFC4122-ish v4 id for new records in backend mode (DB columns are uuid).
 * Exported for callers that mint ids for embedded records (work request tasks).
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
 * Mapping key for a timecard's project: work requests map by id, custom projects by
 * lowercased name. Used both as the store key and the QBT jobcode lookup.
 */
export function jobcodeKeyFor(ref: {
  workRequestId?: string;
  customProjectName?: string;
}): string | null {
  if (ref.workRequestId) return `workRequest:${ref.workRequestId}`;
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
   * Live connectivity (fed by NetInfo at the app root). Drives the offline UI
   * (sync chip, photo-area messages) and the flush-on-reconnect pushes.
   */
  isOnline: boolean;
  /** Outbox depth — queued writes not yet delivered (mirrored for the UI). */
  pendingWriteCount: number;
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
  workRequests: WorkRequest[];
  /** Permanent crews (installers only) — the default scheduling containers. */
  crews: Crew[];
  /** Date-specific crew overrides that win over permanent crews for one day. */
  dailyCrews: DailyCrew[];
  /** Work Request→crew→date links (single source of truth; never duplicates a card). */
  assignments: ScheduleAssignment[];
  logs: TimesheetLog[];
  /** Jobsite photos hydrated from the backend (see also pendingPhotos). */
  jobPhotos: JobPhoto[];
  /** Installer-raised field issues (children of jobs, linked to work requests). */
  jobIssues: JobIssue[];
  /** Documents attached to jobs (photo/pdf/text; created by non-installers). */
  jobDocuments: JobDocument[];
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

  /** UI theme — a per-device preference, persisted locally, applied at launch. */
  theme: ThemeScheme;

  /** Switch the dark/light theme and persist the choice on this device. */
  setTheme: (scheme: ThemeScheme) => void;
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
  /** Reflect connectivity; coming back online pushes queued work immediately. */
  setOnline: (online: boolean) => void;
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
   * change another session makes (e.g. a Field Super creating a work request) streams into this
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
  /**
   * Create a SUB-JOB under a parent job (web: schedulers, field supers, the
   * operator). Inherits the parent's address, scopes, flashing material (+
   * reference photo), and Field Supers; the name is stored WITHOUT the
   * parent's name. Returns null when the parent is missing or is itself a
   * sub-job (one level only).
   */
  addSubJob: (input: {
    parentJobId: string;
    name: string;
    /** The sub-job's own PO, typed at creation (not inherited). */
    po?: string;
    /** Override the inherited jobsite address (creation form edit). */
    location?: string;
    /** Override the inherited scopes (creation form edit). */
    scopes?: JobScope[];
    /** Override the inherited flashing material (creation form edit). */
    flashingMaterial?: string;
  }) => Job | null;
  updateJob: (id: string, changes: Partial<Job>) => void;
  /**
   * Archive a job — what the "delete" actions now do. Sub-jobs archive with
   * their parent. Recoverable from the jobs pages' Archived section; only
   * permanent deletion (removeJob, from that section) destroys data.
   */
  archiveJob: (id: string) => void;
  /** Clear a job's (and its sub-jobs') archived flag — back to active. */
  restoreJob: (id: string) => void;
  /**
   * Additively assign ONE Field Super to a job — the jobs pages' "Assign
   * myself" button. (Full assignment edits go through updateJob with
   * fieldSuperIds instead.) Mirrors onto the job's sub-jobs locally the way
   * the DB trigger does. Already assigned = no-op.
   */
  assignFieldSuperToJob: (jobId: string, fieldSuperId: string) => void;
  /**
   * Delete a jobsite and everything hanging off it. Mirrors the DB's
   * `on delete cascade`: locally drops the job's work requests and any schedule
   * assignments referencing those cards so in-memory state stays consistent.
   */
  removeJob: (id: string) => void;

  // --- Work Requests (field work items) ---
  /**
   * Create a Work Request. `flashingMaterial` defaults to the parent Job's value
   * when omitted, but the caller may pass a per-card override.
   */
  addWorkRequest: (
    card: Omit<WorkRequest, 'id' | 'status' | 'priorityOrder'> & {
      id?: string;
      status?: WorkRequestStatus;
      priorityOrder?: number;
    }
  ) => WorkRequest;
  /**
   * `opts.silentSave` skips the "Changes Saved" pill — for background writes
   * (escalations, reminder stamps) and gestures the UI already confirms (day
   * reordering). Deliberate edit-form saves leave it unset.
   */
  updateWorkRequest: (
    id: string,
    changes: Partial<WorkRequest>,
    opts?: { silentSave?: boolean }
  ) => void;
  /** Delete a Work Request and any schedule assignments pointing at it. */
  deleteWorkRequest: (id: string) => void;
  /** Installer-facing: append/replace shared field notes on a Work Request. */
  updateWorkRequestNotes: (id: string, fieldNotes: string) => void;
  /**
   * Report a work request's field status. `note` is required by the UI for
   * 'Untouched' / 'False Start' (the typed reason) and 'Finished' (the
   * completion note); other statuses clear any previous note. Also stamps
   * who/when for the dashboards.
   */
  setWorkRequestStatus: (
    workRequestId: string,
    status: WorkRequestStatus,
    note?: string
  ) => void;
  /** Installer-facing: check a work request task off (or un-check it). */
  setWorkRequestTaskDone: (workRequestId: string, taskId: string, done: boolean) => void;
  /**
   * Escalate every card whose priority window has ended (and that isn't
   * finished) to "Now" — persisted via updateWorkRequest, whose transition
   * notification pings the schedulers. Installer sessions skip the write (no
   * priority write access); they still SEE the escalated look immediately via
   * the effective-priority helpers.
   */
  escalateDuePriorities: () => void;
  /**
   * The overdue-status check: any work request scheduled on a PAST day (at any
   * hour) — or on TODAY once 4:30 PM local has passed — whose status is still
   * 'Undefined' pings the assigned crew's FOREMAN ("A work request status
   * needs updating"), daily until it's set. Runs in any signed-in session on
   * a timer; the card's `undefinedReminderDate` stamp keeps it to one
   * reminder per card per day across sessions.
   */
  sweepUndefinedStatusReminders: () => void;

  // --- Crews & scheduling (Scheduler) ---
  /** Create a permanent crew. Non-installer ids are dropped. Returns the record. */
  addCrew: (crew: Omit<Crew, 'id'> & { id?: string }) => Crew;
  updateCrew: (id: string, changes: Partial<Crew>) => void;
  removeCrew: (id: string) => void;
  /**
   * Create an ad-hoc daily crew (overrides members' permanent crews on days
   * it has work). Non-installer ids are dropped.
   */
  addDailyCrew: (crew: Omit<DailyCrew, 'id'> & { id?: string }) => DailyCrew;
  updateDailyCrew: (id: string, changes: Partial<DailyCrew>) => void;
  removeDailyCrew: (id: string) => void;
  /** Place a Work Request on a crew for a date. Idempotent on (work request, crew, date). */
  assignWorkRequest: (
    workRequestId: string,
    crewId: string,
    date: string
  ) => ScheduleAssignment;
  unassignWorkRequest: (assignmentId: string) => void;
  /**
   * Persist a day's drag-reordered schedule: renumbers priorityOrder (1…n)
   * across the day's work requests in the given order. Only rows whose order
   * actually changed are written.
   */
  reorderDaySchedule: (date: string, orderedRequestIds: string[]) => void;

  clockIn: (ref: { workRequestId?: string; customProjectName?: string }) => void;
  /** Ends the active shift and returns the generated log, or null if not clocked in. */
  clockOut: () => TimesheetLog | null;
  /** Adjusts the start time of the in-progress shift. */
  updateShiftStart: (startTime: string) => void;
  /** Reassigns the project/work request of the in-progress shift. */
  updateShiftProject: (ref: { workRequestId?: string; customProjectName?: string }) => void;
  updateLog: (
    logId: string,
    changes: Pick<
      Partial<TimesheetLog>,
      'date' | 'workRequestId' | 'customProjectName' | 'startTime' | 'endTime'
    >
  ) => void;
  deleteLog: (logId: string) => void;
  /** Creates a manual timecard from explicit start/end times. */
  addLog: (entry: {
    workRequestId?: string;
    customProjectName?: string;
    startTime: string;
    endTime: string;
  }) => TimesheetLog;

  // --- Job photos ---
  /**
   * Stage captured/picked images for a job (optionally linked to the work request
   * they were taken for) and start the upload queue. Files are moved into app
   * storage first so a queued upload survives an app restart. Returns the new
   * photo ids (in input order) so the caller can attach a note to one.
   */
  addJobPhotos: (input: {
    jobId: string;
    workRequestId?: string;
    issueId?: string;
    taskId?: string;
    /** The captured/picked media files — photos and/or videos, in order. */
    items: { uri: string; isVideo?: boolean }[];
  }) => Promise<string[]>;
  /** Set/replace the caption on a photo (pending or uploaded). Owner-only in the UI. */
  setJobPhotoNote: (id: string, note: string) => void;
  /** Tag/untag a video as an SGD video (pending or uploaded). Owner-only in the UI. */
  setJobPhotoSgd: (id: string, sgdVideo: boolean) => void;
  /** Set/clear a photo's type (pending or uploaded). Owner-only in the UI. */
  setJobPhotoType: (id: string, photoType: JobPhotoType | undefined) => void;
  /** Delete a photo — a queued one locally, an uploaded one from the backend too. */
  deleteJobPhoto: (id: string) => void;
  /** Re-queue failed uploads and kick the queue (also fired by the retry timer). */
  retryPhotoUploads: () => void;
  /**
   * Set/replace a job's Window Flashing Material reference photo. Uploads the
   * image immediately (no offline queue — it's a one-off reference shot taken
   * by the Field Super) and stores its path on the job, so every work request of the
   * job shows it. Returns false when the upload failed.
   */
  setJobFlashingPhoto: (jobId: string, localUri: string) => Promise<boolean>;

  // --- Job documents ---
  /**
   * Attach a document to a job (non-installers only; the UI hides the button
   * for installers). 'text' documents queue offline like any other write;
   * 'photo'/'pdf' upload their file immediately (like the flashing photo) and
   * need a connection. Returns false when the upload failed or was offline.
   */
  addJobDocument: (input: {
    jobId: string;
    kind: JobDocumentKind;
    title: string;
    /** Optional type tag (layout plans / flashing example). */
    docType?: JobDocumentType;
    /** Content of a 'text' document. */
    body?: string;
    /** Local file uri of a 'photo'/'pdf' document (an https URL works too). */
    localUri?: string;
    /** MIME type of the file ('image/jpeg' | 'application/pdf'). */
    contentType?: string;
  }) => Promise<boolean>;
  /**
   * Retag an existing document ("Choose from Job documents" assigns it as a
   * layout plan). Queues offline like other metadata writes.
   */
  setJobDocumentType: (id: string, docType: JobDocumentType | undefined) => void;
  /**
   * Edit a document's title / body (text kind) / type tag. Queues offline.
   * RLS: the creator, the Operator, or a Field Super scoped to the job.
   */
  updateJobDocument: (
    id: string,
    patch: { title: string; body?: string; docType?: JobDocumentType }
  ) => void;
  /**
   * Delete a document (and its storage file, best-effort). Queues offline.
   * Deleting a job's last layout-plan document brings its warning back on its
   * own (the banner derives from the live document list).
   */
  deleteJobDocument: (id: string) => void;

  // --- Job issues ---
  /**
   * Raise a new (empty) issue on a job from a work request's screen. Returns the
   * created record so the UI can focus its description input, or null when
   * signed out.
   */
  addJobIssue: (input: {
    jobId: string;
    workRequestId?: string;
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
  /** Remove a single notification entirely (the recipient dismissed it). */
  dismissNotification: (id: string) => void;
  /** Remove EVERY notification of the current worker (the panel's "Clear all"). */
  clearAllNotifications: () => void;
  /**
   * Notification types this DEVICE has muted (Settings): muted types still
   * land on the bell/panel, but never toast, ping, or vibrate. Per-device by
   * design — a phone and a desk browser can differ. `save_failed` is not
   * mutable (a discarded change must never be missable).
   */
  mutedNotificationTypes: NotificationType[];
  toggleNotificationTypeMuted: (type: NotificationType) => void;

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
let nextWorkRequestId = 100;
let nextIssueId = 100;
let nextCrewId = 100;
let nextDailyCrewId = 100;
let nextAssignmentId = 100;
let nextNotificationId = 100;

// Coalesces the burst of realtime row events one logical change can emit into a
// single collection refetch. Module-level so it survives across store calls.
let dataRefreshTimer: ReturnType<typeof setTimeout> | null = null;

// Hourly check for priority windows that have ended (see escalateDuePriorities).
let escalationTimer: ReturnType<typeof setInterval> | null = null;

// Recurring check for the overdue "status still Undefined" foreman reminders
// (see sweepUndefinedStatusReminders).
let statusReminderTimer: ReturnType<typeof setInterval> | null = null;

// Task check-offs debounce their backend write: rapid toggles otherwise race
// the realtime echo (each write triggers a refetch that briefly reverts the
// box). A card pushes once its checkboxes sit unchanged for this long.
const TASK_PUSH_DELAY_MS = 5000;
const taskPushTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Cards whose latest check-offs haven't landed on the backend yet — refetches
// must keep the LOCAL tasks for these so pending toggles never get clobbered.
const pendingTaskCardIds = new Set<string>();

export const useAppStore = create<AppState>((set, get) => ({
  // Start empty: real data arrives on Supabase sign-in, mock data only via
  // enterDevMode() in local development. The website thus shows no data until
  // a real worker signs in.
  workers: [],
  devBaseUserId: '',
  authWorker: null,
  viewAsUserId: null,
  jobs: [],
  workRequests: [],
  crews: [],
  dailyCrews: [],
  assignments: [],
  logs: [],
  jobPhotos: [],
  jobIssues: [],
  jobDocuments: [],
  pendingPhotos: [],
  notifications: [],
  mutedNotificationTypes: [],
  savedTick: 0,
  flashMessage: null,
  flashTone: 'success',
  flashTick: 0,
  theme: 'dark',
  devMode: false,
  authResolved: false,
  isOnline: true,
  pendingWriteCount: 0,
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

  setTheme: (scheme) => {
    if (get().theme === scheme) return;
    // Swap the live palette first so the remounting tree reads new colors.
    setThemeScheme(scheme);
    set({ theme: scheme });
    AsyncStorage.setItem(THEME_KEY, scheme).catch(() => {});
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

  setOnline: (online) => {
    if (get().isOnline === online) return;
    set({ isOnline: online });
    // Back online: push queued work right away (instead of waiting out the 30s
    // retry timers) and pull whatever changed while we were dark.
    if (online && backendActive(get())) {
      void flushOutbox();
      get().retryPhotoUploads();
      scheduleBackendRefresh();
    }
  },

  setPasswordRecovery: (passwordRecovery) => {
    // Mirror the flag in sessionStorage (web): the recovery hash that raised it
    // is consumed on first load, so without this a reload mid-reset would drop
    // the user into the app signed-in, with no password prompt. session.ts
    // reads the mirror back on launch; cleared when the reset completes or the
    // session ends.
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      try {
        if (passwordRecovery) sessionStorage.setItem('wh-password-recovery', '1');
        else sessionStorage.removeItem('wh-password-recovery');
      } catch {
        // Storage can be unavailable (private mode); the in-memory flag still works.
      }
    }
    set({ passwordRecovery });
  },

  enterDevMode: () => {
    const seed = loadDevSeed();
    if (!seed) return; // production: mock module is stripped, nothing to load
    set({
      workers: seed.mockWorkers,
      jobs: seed.mockJobs,
      workRequests: seed.mockWorkRequests,
      crews: sortCrews(seed.mockCrews),
      dailyCrews: sortDailyCrews(seed.mockDailyCrews),
      assignments: seed.mockAssignments,
      logs: seed.mockLogs,
      jobPhotos: [],
      jobIssues: [],
      jobDocuments: [],
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
    const me0 = get().authWorker;
    // Offline-first reads: fill the screen from the on-device cache right away
    // (photos stay out of it — offline photo areas show a connect message);
    // the live fetch below replaces everything when there's a connection.
    if (me0) {
      const cached = await loadDataCache(me0.id);
      if (cached) {
        set({
          workers: cached.workers,
          jobs: cached.jobs,
          workRequests: cached.workRequests,
          crews: sortCrews(cached.crews),
          dailyCrews: sortDailyCrews(cached.dailyCrews),
          assignments: cached.assignments,
          logs: cached.logs,
          jobIssues: cached.jobIssues,
          // Older caches predate documents — tolerate their absence.
          jobDocuments: cached.jobDocuments ?? [],
        });
      }
    }
    try {
      await syncRealtimeAuth();
    } catch (e) {
      console.warn('Realtime auth sync failed; live updates may not work.', e);
    }
    try {
      const data = await backend.fetchAllData();
      set({
        workers: data.workers,
        jobs: data.jobs,
        workRequests: data.workRequests,
        crews: sortCrews(data.crews),
        dailyCrews: sortDailyCrews(data.dailyCrews),
        assignments: data.assignments,
        logs: data.logs,
        jobPhotos: data.jobPhotos,
        jobIssues: data.jobIssues,
        jobDocuments: data.jobDocuments,
      });
      if (me0) {
        persistDataCache(me0.id, data);
        // Flashing-material photos must render on site — pull them into the
        // image disk cache while there's signal.
        prefetchFlashingPhotos(data.jobs);
      }
    } catch (e) {
      // No signal (or backend down): the cache above keeps the app usable, the
      // realtime channel below reconnects on its own, and setOnline pulls
      // fresh data the moment connectivity returns.
      console.warn('Live data fetch failed; showing cached data.', e);
    }
    // Resume photo uploads that were still queued when the app last closed
    // (their files were stashed in app storage). Restored entries are this
    // worker's own — another account's queue stays parked until they sign in.
    if (me0) {
      // Replay writes queued before the app last closed (offline edits).
      await restoreOutbox(me0.id);
      void flushOutbox();
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
        // Retention, best-effort: rows older than 30 days are past the
        // panel's usefulness — sweep them so the table can't grow forever.
        notificationsBackend.deleteOldNotifications(me.id).catch(() => {});
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
    backend.subscribeAllData(() => scheduleBackendRefresh());
    // Sweep for due priority windows now and hourly, so a card whose end date
    // arrives while a session sits open still escalates (and pings) that day.
    get().escalateDuePriorities();
    if (escalationTimer) clearInterval(escalationTimer);
    escalationTimer = setInterval(
      () => get().escalateDuePriorities(),
      60 * 60 * 1000
    );
    // The overdue "status still Undefined" foreman reminders: check now and
    // every 5 minutes so an open session catches the 4:30 PM boundary the day
    // it happens (the per-card date stamp keeps it to one ping per day).
    get().sweepUndefinedStatusReminders();
    if (statusReminderTimer) clearInterval(statusReminderTimer);
    statusReminderTimer = setInterval(
      () => get().sweepUndefinedStatusReminders(),
      5 * 60 * 1000
    );
  },

  refreshBackendData: async () => {
    const data = await backend.fetchAllData();
    set((state) => ({
      workers: data.workers,
      jobs: data.jobs,
      // Cards with task check-offs still in their debounce window OR with a
      // queued write keep the LOCAL task list — fetched rows predate those.
      workRequests: data.workRequests.map((card) =>
        pendingTaskCardIds.has(card.id) || pendingWorkRequestTaskWrites.has(card.id)
          ? {
              ...card,
              tasks:
                state.workRequests.find((c) => c.id === card.id)?.tasks ??
                card.tasks,
            }
          : card
      ),
      crews: sortCrews(data.crews),
      dailyCrews: sortDailyCrews(data.dailyCrews),
      assignments: data.assignments,
      logs: data.logs,
      // Photos with a queued note write keep the LOCAL note. (No local row —
      // e.g. right after a fresh launch restored the queue — keeps fetched.)
      jobPhotos: data.jobPhotos.map((photo) => {
        if (!pendingPhotoNotes.has(photo.id)) return photo;
        const local = state.jobPhotos.find((p) => p.id === photo.id);
        return local ? { ...photo, note: local.note } : photo;
      }),
      // Documents with a queued insert survive refreshes that predate them;
      // ones with a queued update (retag/edit) keep their local shape, and
      // ones with a queued delete stay gone.
      jobDocuments: [
        ...state.jobDocuments.filter(
          (doc) =>
            pendingDocumentInserts.has(doc.id) &&
            !data.jobDocuments.some((f) => f.id === doc.id)
        ),
        ...data.jobDocuments
          .filter((doc) => !pendingDocumentDeletes.has(doc.id))
          .map((doc) => {
            if (!pendingDocumentUpdates.has(doc.id)) return doc;
            const local = state.jobDocuments.find((d) => d.id === doc.id);
            return local ?? doc;
          }),
      ],
      // Issues with unsettled writes keep their local shape: pending deletes
      // stay gone, pending inserts/updates keep the local row (including ones
      // the fetched snapshot predates entirely).
      jobIssues: [
        ...state.jobIssues.filter(
          (issue) =>
            pendingIssueUpserts.has(issue.id) &&
            !data.jobIssues.some((f) => f.id === issue.id)
        ),
        ...data.jobIssues
          .filter((issue) => !pendingIssueDeletes.has(issue.id))
          .map((issue) =>
            pendingIssueUpserts.has(issue.id)
              ? (state.jobIssues.find((i) => i.id === issue.id) ?? issue)
              : issue
          ),
      ],
    }));
    // Keep the offline cache tracking the server (raw fetched state — queued
    // local edits are re-applied by the outbox replay, not the cache).
    const me = get().authWorker;
    if (me) {
      persistDataCache(me.id, data);
      prefetchFlashingPhotos(data.jobs);
    }
  },

  clearData: () => {
    notificationsBackend.unsubscribeNotifications();
    backend.unsubscribeAllData();
    if (dataRefreshTimer) {
      clearTimeout(dataRefreshTimer);
      dataRefreshTimer = null;
    }
    for (const timer of taskPushTimers.values()) clearTimeout(timer);
    taskPushTimers.clear();
    pendingTaskCardIds.clear();
    refreshDeferred = false;
    pendingIssueUpserts.clear();
    pendingIssueDeletes.clear();
    pendingPhotoNotes.clear();
    pendingWorkRequestTaskWrites.clear();
    // Park (don't drop) queued writes: the in-memory queue clears but the
    // persisted copy stays under the owner's key for their next sign-in.
    if (outboxRetryTimer) {
      clearTimeout(outboxRetryTimer);
      outboxRetryTimer = null;
    }
    outboxOps = [];
    outboxGuardReleases.clear();
    set({ pendingWriteCount: 0 });
    if (escalationTimer) {
      clearInterval(escalationTimer);
      escalationTimer = null;
    }
    if (statusReminderTimer) {
      clearInterval(statusReminderTimer);
      statusReminderTimer = null;
    }
    if (photoRetryTimer) {
      clearTimeout(photoRetryTimer);
      photoRetryTimer = null;
    }
    set({
      workers: [],
      jobs: [],
      workRequests: [],
      crews: [],
      dailyCrews: [],
      assignments: [],
      logs: [],
      // Pending photo files/queue stay stashed on disk — they resume when
      // their owner signs back in (restorePendingPhotos filters by worker).
      jobPhotos: [],
      jobIssues: [],
      jobDocuments: [],
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
    if (backendActive(get()) && updated) write('updateWorker', updated);
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
    if (backendActive(get()) && updated) write('updateWorker', updated);
  },

  removeWorker: (id) => {
    set((state) => ({ workers: state.workers.filter((w) => w.id !== id) }));
    if (backendActive(get())) write('deleteWorker', id);
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
    if (backendActive(get()) && updated) write('updateWorkerRole', { id, role });
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
    if (backendActive(get()) && updated) write('updateWorkerRate', { id, hourlyRate });
  },

  addJob: (job) => {
    const state = get();
    const isBackend = backendActive(state);
    const me = currentWorkerOf(state);
    const created: Job = {
      status: 'Active',
      ...job,
      id: job.id ?? (isBackend ? uuid() : `job-${nextJobId++}`),
    };
    // A Field Super creating a job is auto-assigned to it — otherwise it
    // would vanish from their scoped views immediately. The DB does the same
    // server-side via trigger (they can't write job_field_supers themselves),
    // so this only mirrors it locally; the write payload stays untouched.
    const local: Job =
      me?.role === 'field_super' && !created.parentJobId
        ? {
            ...created,
            fieldSuperIds: [
              ...new Set([...(created.fieldSuperIds ?? []), me.id]),
            ],
          }
        : created;
    set((s) => ({ jobs: [local, ...s.jobs] }));
    // insertJob writes the job row and, for the Operator and Schedulers, its
    // Field Super assignments (job_field_supers).
    if (isBackend) write('insertJob', created);
    // A top-level job born without a QBT jobcode needs the Finance Manager to
    // map it — ping them (unless a finance manager somehow created it).
    if (
      !created.parentJobId &&
      !created.qbtJobcodeId &&
      me?.role !== 'finance_manager'
    ) {
      const recipients = idsWithRole(state.workers, 'finance_manager');
      if (recipients.length > 0) {
        get().pushNotification({
          recipientIds: recipients,
          type: 'job_needs_qbt',
          title: created.po?.trim()
            ? `${created.po.trim()} · ${created.name}`
            : created.name,
          body: 'Needs a QBT jobcode',
          data: { jobId: created.id },
        });
      }
    }
    return local;
  },

  addSubJob: ({ parentJobId, name, po, location, scopes, flashingMaterial }) => {
    const state = get();
    const parent = state.jobs.find((j) => j.id === parentJobId);
    // One level only — a sub-job can't parent another.
    if (!parent || parent.parentJobId) return null;
    const isBackend = backendActive(state);
    const created: Job = {
      id: isBackend ? uuid() : `job-${nextJobId++}`,
      name,
      po,
      status: 'Active',
      parentJobId,
      // Inherited from the parent (the creation form may override; all remain
      // editable on the sub-job afterwards).
      location: location ?? parent.location,
      scopes: scopes ?? (parent.scopes ? [...parent.scopes] : undefined),
      flashingMaterial: flashingMaterial ?? parent.flashingMaterial,
      flashingPhotoPath: parent.flashingPhotoPath,
      flashingPhotoUrl: parent.flashingPhotoUrl,
      // For immediate UI only — the DB trigger mirrors the join-table rows
      // (insertJob skips setJobFieldSupers for sub-jobs; the creator may not
      // have write access to job_field_supers).
      fieldSuperIds: parent.fieldSuperIds ? [...parent.fieldSuperIds] : [],
    };
    set((s) => ({ jobs: [created, ...s.jobs] }));
    if (isBackend) write('insertJob', created);
    return created;
  },

  updateJob: (id, changes) => {
    // Pre-edit assignment list — the "who was newly added" ping below diffs
    // against it. Only captured when the edit actually touches assignments.
    const beforeSuperIds =
      'fieldSuperIds' in changes
        ? (get().jobs.find((j) => j.id === id)?.fieldSuperIds ?? [])
        : undefined;
    let updated: Job | undefined;
    set((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.id === id) {
          updated = { ...job, ...changes };
          return updated;
        }
        // Sub-jobs inherit the parent's Field Supers — mirror the DB trigger
        // locally so the change shows on them without waiting for a refetch.
        if ('fieldSuperIds' in changes && job.parentJobId === id) {
          return {
            ...job,
            fieldSuperIds: changes.fieldSuperIds
              ? [...changes.fieldSuperIds]
              : [],
          };
        }
        return job;
      }),
    }));
    if (backendActive(get()) && updated) {
      // Job-column edits go to the jobs table. Field-Super assignments live in
      // the separate job_field_supers join table (operator, scheduler, and
      // field supers may write it; RLS matches), so only touch it when
      // fieldSuperIds is actually part of this edit — a Field Super saving
      // flashing material must not hit job_field_supers.
      write('updateJob', updated);
      if ('fieldSuperIds' in changes) {
        write('setJobFieldSupers', {
          jobId: id,
          fieldSuperIds: updated.fieldSuperIds ?? [],
        });
      }
    }
    // Each NEWLY-assigned Field Super gets a ping — unless they assigned
    // themselves (self-assign goes through assignFieldSuperToJob anyway).
    if (updated && 'fieldSuperIds' in changes && beforeSuperIds) {
      const me = currentWorkerOf(get());
      const added = (updated.fieldSuperIds ?? []).filter(
        (wid) => !beforeSuperIds!.includes(wid) && wid !== me?.id
      );
      if (added.length > 0) {
        get().pushNotification({
          recipientIds: added,
          type: 'job_assigned',
          title: jobNotificationTitle(get(), updated.id) || updated.name,
          body: "You've been assigned to this job",
          data: { jobId: updated.id },
        });
      }
    }
  },

  archiveJob: (id) => {
    const archivedAt = new Date().toISOString();
    const { jobs, updateJob } = get();
    // Parent → the whole family archives together.
    const family = [
      id,
      ...jobs.filter((j) => j.parentJobId === id).map((j) => j.id),
    ];
    family.forEach((jobId) => updateJob(jobId, { archivedAt }));
  },

  restoreJob: (id) => {
    const { jobs, updateJob } = get();
    const family = [
      id,
      ...jobs.filter((j) => j.parentJobId === id).map((j) => j.id),
    ];
    family.forEach((jobId) => updateJob(jobId, { archivedAt: undefined }));
  },

  assignFieldSuperToJob: (jobId, fieldSuperId) => {
    let changed = false;
    set((state) => ({
      jobs: state.jobs.map((job) => {
        // The job itself + its sub-jobs (the DB trigger mirrors parent
        // assignments onto sub-jobs; keep local state matching).
        if (job.id !== jobId && job.parentJobId !== jobId) return job;
        const ids = job.fieldSuperIds ?? [];
        if (ids.includes(fieldSuperId)) return job;
        if (job.id === jobId) changed = true;
        return { ...job, fieldSuperIds: [...ids, fieldSuperId] };
      }),
    }));
    if (changed && backendActive(get())) {
      write('assignJobFieldSuper', { jobId, fieldSuperId });
    }
  },

  removeJob: (id) => {
    set((state) => {
      // Cascade locally the way the DB does: drop the job's SUB-JOBS, every
      // affected job's work requests, then any schedule assignments pointing at
      // those (now-orphaned) cards.
      const removedJobIds = new Set([
        id,
        ...state.jobs
          .filter((job) => job.parentJobId === id)
          .map((job) => job.id),
      ]);
      const orphanedCardIds = new Set(
        state.workRequests
          .filter((c) => c.jobId && removedJobIds.has(c.jobId))
          .map((c) => c.id)
      );
      return {
        jobs: state.jobs.filter((job) => !removedJobIds.has(job.id)),
        workRequests: state.workRequests
          // A card dies with its PRIMARY job (the DB's job_id FK cascade)...
          .filter((c) => !(c.jobId && removedJobIds.has(c.jobId)))
          // ...but a multi-linked card merely sheds a removed SECONDARY
          // sub-job from its link list (the job_ids array has no FK).
          .map((c) =>
            c.jobIds?.some((id) => removedJobIds.has(id))
              ? {
                  ...c,
                  jobIds: (() => {
                    const kept = c.jobIds.filter(
                      (jid) => !removedJobIds.has(jid)
                    );
                    return kept.length > 1 ? kept : undefined;
                  })(),
                }
              : c
          ),
        assignments: state.assignments.filter(
          (a) => !orphanedCardIds.has(a.workRequestId)
        ),
      };
    });
    // The DB cascade handles work requests/assignments server-side; we only fire the
    // job delete.
    if (backendActive(get())) write('deleteJob', id);
  },

  addWorkRequest: (card) => {
    const state = get();
    // Default the card's flashing material to the parent Job's value, snapshotted
    // at creation time (a later Job edit must not mutate existing cards). The
    // Field Super may pass an explicit override, which wins over the inherited value.
    const parentJob = card.jobId
      ? state.jobs.find((job) => job.id === card.jobId)
      : undefined;
    // Default the intra-day sort key to one past the busiest card on that date.
    const maxOrderOnDate = state.workRequests
      .filter((c) => c.date === card.date)
      .reduce((max, c) => Math.max(max, c.priorityOrder), 0);
    const isBackend = backendActive(state);
    const created: WorkRequest = {
      ...card,
      id: card.id ?? (isBackend ? uuid() : `jc-${nextWorkRequestId++}`),
      status: card.status ?? 'Undefined',
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
    set({ workRequests: [created, ...state.workRequests] });
    if (isBackend) write('insertWorkRequest', created);
    // A brand-new "Now" card pings the schedulers right away. Otherwise a
    // Field-Super-created card still lands on the schedulers' radar with a
    // quieter "new work request" ping (one message, never both).
    const creator = currentWorkerOf(state);
    if (created.priority === 'Now') {
      notifyNowWorkRequest(get, created);
    } else if (creator?.role === 'field_super') {
      const recipients = idsWithRole(state.workers, 'scheduler');
      if (recipients.length > 0) {
        get().pushNotification({
          recipientIds: recipients,
          type: 'work_request_created',
          title: workRequestNotificationTitle(state, created.jobId, created.title),
          body: `Created by ${creator.name}`,
          data: { workRequestId: created.id },
        });
      }
    }
    return created;
  },

  updateWorkRequest: (id, changes, opts) => {
    const before = get().workRequests.find((c) => c.id === id);
    let updated: WorkRequest | undefined;
    let wasNow = false;
    set((state) => ({
      workRequests: state.workRequests.map((card) => {
        if (card.id !== id) return card;
        wasNow = card.priority === 'Now';
        updated = { ...card, ...changes };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) {
      write('updateWorkRequest', updated, undefined, {
        silent: opts?.silentSave,
      });
    }
    // Ping only on the transition INTO "Now" — re-saving an already-"Now" card
    // (or any other edit) must not re-notify.
    if (updated && updated.priority === 'Now' && !wasNow) {
      notifyNowWorkRequest(get, updated);
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
            `Priority changed to ${updated.priority}`
          );
        } else if (contentChanged) {
          notifyScheduleChange(get, audience, updated, 'Updated');
        }
      }
    }
  },

  deleteWorkRequest: (id) => {
    set((state) => ({
      // Mirror the DB cascade locally: drop the card, then any schedule
      // assignments that pointed at it.
      workRequests: state.workRequests.filter((card) => card.id !== id),
      assignments: state.assignments.filter((a) => a.workRequestId !== id),
    }));
    // The DB cascades assignments server-side; we only fire the card delete.
    if (backendActive(get())) write('deleteWorkRequest', id);
  },

  updateWorkRequestNotes: (id, fieldNotes) => {
    let updated: WorkRequest | undefined;
    set((state) => ({
      workRequests: state.workRequests.map((card) => {
        if (card.id !== id) return card;
        updated = { ...card, fieldNotes };
        return updated;
      }),
    }));
    // Inline typing commit — no pill.
    if (backendActive(get()) && updated) {
      write('updateWorkRequest', updated, undefined, { silent: true });
    }
  },

  setWorkRequestStatus: (workRequestId, status, note) => {
    const me = currentWorkerOf(get());
    const before = get().workRequests.find((c) => c.id === workRequestId);
    let updated: WorkRequest | undefined;
    const changedAt = new Date().toISOString();
    set((state) => ({
      workRequests: state.workRequests.map((card) => {
        if (card.id !== workRequestId) return card;
        updated = {
          ...card,
          status,
          // The reason (Untouched / False Start) or completion note
          // (Finished); statuses without one clear any stale note.
          statusNote: note?.trim() || undefined,
          statusChangedAt: changedAt,
          statusChangedById: me?.id,
          // Every change — including a reset to 'Undefined' — appends to the
          // permanent status log the office reviews from the quick view.
          statusLog: [
            ...(card.statusLog ?? []),
            {
              id: uuid(),
              status,
              note: note?.trim() || undefined,
              at: changedAt,
              byId: me?.id,
            },
          ],
        };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write('updateWorkRequest', updated);
    // Ping the office (schedulers + the job's Field Supers, minus the
    // reporter) about the field report — only on an actual change, so
    // re-saving the same status/note stays silent.
    if (
      updated &&
      before &&
      (before.status !== updated.status ||
        (before.statusNote ?? '') !== (updated.statusNote ?? ''))
    ) {
      const state = get();
      const recipients = officeAudienceForCard(state, updated, me?.id);
      if (recipients.length > 0) {
        get().pushNotification({
          recipientIds: recipients,
          type: 'status_reported',
          title: workRequestNotificationTitle(state, updated.jobId, updated.title),
          // A move back to 'Undefined' is an office reset, not a field
          // report. "Reported <status>" bodies get their status word colored
          // by the notification renderers.
          body:
            updated.status === 'Undefined'
              ? 'Status reset'
              : `Reported ${updated.status}${
                  updated.statusNote ? ` — ${updated.statusNote}` : ''
                }`,
          data: { workRequestId: updated.id },
        });
      }
    }
  },

  setWorkRequestTaskDone: (workRequestId, taskId, done) => {
    const me = currentWorkerOf(get());
    let updated: WorkRequest | undefined;
    set((state) => ({
      workRequests: state.workRequests.map((card) => {
        if (card.id !== workRequestId || !card.tasks) return card;
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
    if (backendActive(get()) && updated) {
      pendingTaskCardIds.add(workRequestId);
      const existing = taskPushTimers.get(workRequestId);
      if (existing) clearTimeout(existing);
      taskPushTimers.set(
        workRequestId,
        setTimeout(() => {
          taskPushTimers.delete(workRequestId);
          const card = get().workRequests.find((c) => c.id === workRequestId);
          if (!card) {
            pendingTaskCardIds.delete(workRequestId);
            return;
          }
          // The queued-op guard takes over from the debounce-window Set.
          pendingTaskCardIds.delete(workRequestId);
          // Checkbox ticks — the box itself is the confirmation; no pill.
          write(
            'updateWorkRequest',
            card,
            { map: 'workRequestTasks', id: workRequestId },
            { silent: true }
          );
        }, TASK_PUSH_DELAY_MS)
      );
    }
  },

  escalateDuePriorities: () => {
    const state = get();
    // Installers can't write work request priority; a privileged session (scheduler
    // / field super / operator) — or local dev mode — persists the escalation.
    const me = currentWorkerOf(state);
    if (backendActive(state) && me?.role === 'installer') return;
    const today = todayStr();
    const due = state.workRequests.filter(
      (card) =>
        card.priority !== 'Now' &&
        card.priorityEndDate != null &&
        card.priorityEndDate <= today &&
        card.status !== 'Finished'
    );
    // updateWorkRequest handles the backend write AND the scheduler ping (it fires
    // on every transition into "Now"). silentSave: a background escalation
    // isn't a save the worker made.
    due.forEach((card) =>
      get().updateWorkRequest(card.id, { priority: 'Now' }, { silentSave: true })
    );
  },

  sweepUndefinedStatusReminders: () => {
    const state = get();
    const now = new Date();
    const today = todayStr();
    // A card on any PAST day with no status is overdue at any hour; today's
    // cards only become due at 4:30 PM local (the day's reports should be in).
    const after430 = now.getHours() * 60 + now.getMinutes() >= 16 * 60 + 30;

    // Which crews have each due card on their board.
    const crewsByCard = new Map<string, Set<string>>();
    for (const a of state.assignments) {
      if (a.date > today || (a.date === today && !after430)) continue;
      const set = crewsByCard.get(a.workRequestId) ?? new Set<string>();
      set.add(a.crewId);
      crewsByCard.set(a.workRequestId, set);
    }

    for (const [cardId, crewIds] of crewsByCard) {
      const card = state.workRequests.find((c) => c.id === cardId);
      if (!card || card.status !== 'Undefined') continue;
      // Already reminded today (possibly by another session's sweep).
      if (card.undefinedReminderDate === today) continue;
      // Stamp before pinging so racing sessions can at most rarely double-send.
      // (undefinedReminderDate isn't installer-visible, so no schedule ping;
      // silentSave — a bookkeeping stamp, not a save the worker made.)
      get().updateWorkRequest(
        cardId,
        { undefinedReminderDate: today },
        { silentSave: true }
      );
      const recipients = new Set<string>();
      for (const crewId of crewIds) {
        for (const id of foremenForCrew(state, crewId)) recipients.add(id);
      }
      if (recipients.size === 0) continue;
      get().pushNotification({
        recipientIds: [...recipients],
        type: 'status_update_needed',
        title: workRequestNotificationTitle(state, card.jobId, card.title),
        body: 'Status needs updating',
        data: { workRequestId: cardId },
      });
    }
  },

  addCrew: (crew) => {
    const state = get();
    const isBackend = backendActive(state);
    // One permanent crew per installer: ids already on another crew are
    // dropped (the UI blocks picking them; this + a DB unique index are the
    // backstops). Daily crews are exempt.
    const takenElsewhere = new Set(state.crews.flatMap((c) => c.installerIds));
    const installerIds = onlyInstallerIds(
      state.workers,
      crew.installerIds
    ).filter((wid) => !takenElsewhere.has(wid));
    const created: Crew = {
      ...crew,
      id: crew.id ?? (isBackend ? uuid() : `crew-${nextCrewId++}`),
      installerIds,
      // The foreman must be one of the crew's members (UI enforces exactly one).
      foremanId:
        crew.foremanId && installerIds.includes(crew.foremanId)
          ? crew.foremanId
          : undefined,
    };
    set({ crews: sortCrews([...state.crews, created]) });
    if (isBackend) write('insertCrew', created);
    return created;
  },

  updateCrew: (id, changes) => {
    let updated: Crew | undefined;
    set((state) => {
      // One permanent crew per installer — same backstop as addCrew, against
      // every OTHER crew's membership.
      const takenElsewhere = new Set(
        state.crews.filter((c) => c.id !== id).flatMap((c) => c.installerIds)
      );
      return {
        crews: sortCrews(
          state.crews.map((crew) => {
            if (crew.id !== id) return crew;
            const merged: Crew = {
              ...crew,
              ...changes,
              installerIds: changes.installerIds
                ? onlyInstallerIds(state.workers, changes.installerIds).filter(
                    (wid) => !takenElsewhere.has(wid)
                  )
                : crew.installerIds,
            };
            // A foreman who leaves the crew loses the tag (the UI then demands a
            // replacement — every permanent crew needs exactly one).
            if (
              merged.foremanId &&
              !merged.installerIds.includes(merged.foremanId)
            ) {
              merged.foremanId = undefined;
            }
            updated = merged;
            return updated;
          })
        ),
      };
    });
    if (backendActive(get()) && updated) write('updateCrew', updated);
  },

  removeCrew: (id) => {
    set((state) => ({ crews: state.crews.filter((crew) => crew.id !== id) }));
    if (backendActive(get())) write('deleteCrew', id);
  },

  addDailyCrew: (crew) => {
    const state = get();
    const isBackend = backendActive(state);
    const created: DailyCrew = {
      ...crew,
      id: crew.id ?? (isBackend ? uuid() : `dc-${nextDailyCrewId++}`),
      installerIds: onlyInstallerIds(state.workers, crew.installerIds),
    };
    set({ dailyCrews: sortDailyCrews([...state.dailyCrews, created]) });
    if (isBackend) write('insertDailyCrew', created);
    return created;
  },

  updateDailyCrew: (id, changes) => {
    let updated: DailyCrew | undefined;
    set((state) => ({
      dailyCrews: sortDailyCrews(
        state.dailyCrews.map((crew) => {
          if (crew.id !== id) return crew;
          updated = {
            ...crew,
            ...changes,
            installerIds: changes.installerIds
              ? onlyInstallerIds(state.workers, changes.installerIds)
              : crew.installerIds,
          };
          return updated;
        })
      ),
    }));
    if (backendActive(get()) && updated) write('updateDailyCrew', updated);
  },

  removeDailyCrew: (id) => {
    set((state) => ({
      dailyCrews: state.dailyCrews.filter((crew) => crew.id !== id),
    }));
    if (backendActive(get())) write('deleteDailyCrew', id);
  },

  assignWorkRequest: (workRequestId, crewId, date) => {
    const state = get();
    // Idempotent: a repeated drop of the same card onto the same crew/date must
    // not create a duplicate — keep the source of truth single.
    const existing = state.assignments.find(
      (a) => a.workRequestId === workRequestId && a.crewId === crewId && a.date === date
    );
    if (existing) return existing;
    const isBackend = backendActive(state);
    const created: ScheduleAssignment = {
      id: isBackend ? uuid() : `asn-${nextAssignmentId++}`,
      workRequestId,
      crewId,
      date,
    };
    set({ assignments: [...state.assignments, created] });
    // The card visibly landing on the board IS the confirmation — no pill.
    if (isBackend) write('insertAssignment', created, undefined, { silent: true });
    // A card joining TODAY's board pings that crew's installers. A future-dated
    // assignment is silent for installers (only same-day changes notify).
    const card = state.workRequests.find((c) => c.id === workRequestId);
    if (date === todayStr()) {
      if (card) {
        notifyScheduleChange(
          get,
          installersOnActiveCrewForDate(state, crewId, date),
          card,
          'Added to your calendar today'
        );
      }
    }
    // A scheduler scheduling (or moving — moves land here as a fresh insert)
    // a card pings the job's Field Supers, any date.
    const actor = currentWorkerOf(state);
    if (card && actor?.role === 'scheduler') {
      const recipients = jobFieldSuperIds(state, card.jobId);
      if (recipients.length > 0) {
        get().pushNotification({
          recipientIds: recipients,
          type: 'work_request_scheduled',
          title: workRequestNotificationTitle(state, card.jobId, card.title),
          body: `Scheduled for ${format(
            parse(date, 'yyyy-MM-dd', new Date()),
            'MMM d'
          )}`,
          data: { workRequestId: card.id },
        });
      }
    }
    return created;
  },

  unassignWorkRequest: (assignmentId) => {
    const state = get();
    const removed = state.assignments.find((a) => a.id === assignmentId);
    set({
      assignments: state.assignments.filter((a) => a.id !== assignmentId),
    });
    if (backendActive(state)) {
      // The card visibly leaving the board IS the confirmation — no pill.
      write('deleteAssignment', assignmentId, undefined, { silent: true });
    }
    // Removing a card from TODAY's board pings the affected installers. Resolve
    // the audience against pre-removal state (the assignment still exists there).
    if (removed && removed.date === todayStr()) {
      const card = state.workRequests.find((c) => c.id === removed.workRequestId);
      if (card) {
        notifyScheduleChange(
          get,
          installersOnActiveCrewForDate(state, removed.crewId, removed.date),
          card,
          'Taken off your calendar today'
        );
      }
    }
  },

  reorderDaySchedule: (date, orderedRequestIds) => {
    void date; // The order list is authoritative; date is for the caller's clarity.
    orderedRequestIds.forEach((id, index) => {
      const order = index + 1;
      const card = get().workRequests.find((c) => c.id === id);
      if (card && card.priorityOrder !== order) {
        // One drag fires a write per re-numbered card — a pill per card would
        // be a burst of noise for a single gesture the board already shows.
        get().updateWorkRequest(id, { priorityOrder: order }, { silentSave: true });
      }
    });
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
      workRequestId: state.activeShift.workRequestId,
      customProjectName: state.activeShift.customProjectName,
      startTime: state.activeShift.startTime,
      endTime: end.toISOString(),
      totalHours,
      earnedAmount: Math.round(totalHours * me.hourlyRate * 100) / 100,
      sendStatus: 'unsent',
    };
    set({ activeShift: null, logs: [log, ...state.logs] });
    if (isBackend) write('insertTimesheet', log);
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
              workRequestId: ref.workRequestId,
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
    if (backendActive(get()) && updatedLog) write('updateTimesheet', updatedLog);
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
    if (backendActive(get())) write('deleteTimesheet', logId);
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
      workRequestId: entry.workRequestId,
      customProjectName: entry.customProjectName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      totalHours,
      earnedAmount: Math.round(totalHours * me.hourlyRate * 100) / 100,
      sendStatus: 'unsent',
    };
    set({ logs: [log, ...state.logs] });
    if (isBackend) write('insertTimesheet', log);
    return log;
  },

  addJobPhotos: async (input) => {
    const state = get();
    const me = currentWorkerOf(state);
    if (!me) return [];
    const createdIds: string[] = [];
    const isBackend = backendActive(state);
    for (const item of input.items) {
      // A file over the bucket's size cap would be rejected server-side on
      // every retry — refuse it up front with a visible warning instead of a
      // silent post-queue drop. (Only library videos can realistically hit
      // this; in-camera recordings are capped well below it.)
      if (item.isVideo) {
        const size = await mediaFileSize(item.uri);
        if (size != null && size > MAX_UPLOAD_BYTES) {
          get().flash('Video too large to upload (200 MB max)', 'warning');
          continue;
        }
      }
      const id = uuid();
      let stashed: string;
      try {
        stashed = await stashPhotoFile(item.uri, id, item.isVideo ? 'mp4' : 'jpg');
      } catch (e) {
        console.error('Could not stage photo file:', e);
        continue;
      }
      if (isBackend) {
        const pending: PendingJobPhoto = {
          id,
          jobId: input.jobId,
          workRequestId: input.workRequestId,
          issueId: input.issueId,
          taskId: input.taskId,
          workerId: me.id,
          localUri: stashed,
          takenAt: new Date().toISOString(),
          state: 'queued',
          isVideo: item.isVideo,
        };
        set((s) => ({ pendingPhotos: [pending, ...s.pendingPhotos] }));
      } else {
        // Local dev: no backend — the photo lives in memory for this session.
        const photo: JobPhoto = {
          id,
          jobId: input.jobId,
          workRequestId: input.workRequestId,
          issueId: input.issueId,
          taskId: input.taskId,
          workerId: me.id,
          storagePath: '',
          url: stashed,
          takenAt: new Date().toISOString(),
          isVideo: item.isVideo,
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
      // Inline typing commit — no pill.
      write(
        'updateJobPhotoNote',
        { id, note: value },
        { map: 'photoNote', id },
        { silent: true }
      );
    }
  },

  setJobPhotoSgd: (id, sgdVideo) => {
    // Mirrors setJobPhotoNote: a still-pending video carries the tag along in
    // the queue; an uploaded one writes through the outbox (photoNote's guard
    // map keeps the whole local row safe from a stale refetch either way).
    if (get().pendingPhotos.some((p) => p.id === id)) {
      set((s) => ({
        pendingPhotos: s.pendingPhotos.map((p) =>
          p.id === id ? { ...p, sgdVideo } : p
        ),
      }));
      persistPendingPhotos(get().pendingPhotos);
      return;
    }
    let found = false;
    set((s) => ({
      jobPhotos: s.jobPhotos.map((p) => {
        if (p.id !== id) return p;
        found = true;
        return { ...p, sgdVideo };
      }),
    }));
    if (backendActive(get()) && found) {
      // A toggled badge — the UI already shows it; no pill.
      write(
        'updateJobPhotoSgd',
        { id, sgdVideo },
        { map: 'photoNote', id },
        { silent: true }
      );
    }
  },

  setJobPhotoType: (id, photoType) => {
    // Mirrors setJobPhotoSgd: a still-pending photo carries the type along in
    // the queue; an uploaded one writes through the outbox.
    if (get().pendingPhotos.some((p) => p.id === id)) {
      set((s) => ({
        pendingPhotos: s.pendingPhotos.map((p) =>
          p.id === id ? { ...p, photoType } : p
        ),
      }));
      persistPendingPhotos(get().pendingPhotos);
      return;
    }
    let found = false;
    set((s) => ({
      jobPhotos: s.jobPhotos.map((p) => {
        if (p.id !== id) return p;
        found = true;
        return { ...p, photoType };
      }),
    }));
    if (backendActive(get()) && found) {
      // A toggled chip — the UI already shows it; no pill.
      write(
        'updateJobPhotoType',
        { id, photoType },
        { map: 'photoNote', id },
        { silent: true }
      );
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
      write('deleteJobPhoto', { id, storagePath: photo.storagePath });
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

  addJobDocument: async (input) => {
    const state = get();
    const me = currentWorkerOf(state);
    if (!me) return false;
    const isBackend = backendActive(state);
    const doc: JobDocument = {
      id: uuid(),
      jobId: input.jobId,
      workerId: me.id,
      kind: input.kind,
      docType: input.docType,
      title: input.title.trim(),
      body: input.kind === 'text' ? input.body : undefined,
      createdAt: new Date().toISOString(),
    };

    if (input.kind !== 'text') {
      if (!input.localUri) return false;
      if (!isBackend) {
        // Local dev: the local uri renders/opens directly this session.
        doc.url = input.localUri;
        set((s) => ({ jobDocuments: [doc, ...s.jobDocuments] }));
        return true;
      }
      // Files upload immediately (like the flashing photo) — no offline queue
      // for bytes, so this needs a connection.
      const ext = input.kind === 'photo' ? 'jpg' : 'pdf';
      const storagePath = `${input.jobId}/doc-${doc.id}.${ext}`;
      try {
        await backend.uploadJobDocumentFile(
          input.localUri,
          storagePath,
          input.contentType ?? (input.kind === 'photo' ? 'image/jpeg' : 'application/pdf')
        );
      } catch (e) {
        console.error('Document upload failed:', e);
        get().flash(
          'Document upload failed — check your signal and retry',
          'warning'
        );
        return false;
      }
      doc.storagePath = storagePath;
      doc.url = backend.jobDocumentUrl(storagePath);
    }

    set((s) => ({ jobDocuments: [doc, ...s.jobDocuments] }));
    if (isBackend) {
      write('insertJobDocument', doc, { map: 'documentInsert', id: doc.id });
    }
    return true;
  },

  setJobDocumentType: (id, docType) => {
    set((s) => ({
      jobDocuments: s.jobDocuments.map((doc) =>
        doc.id === id ? { ...doc, docType } : doc
      ),
    }));
    if (backendActive(get())) {
      // A retag the picker already reflects — no pill.
      write(
        'updateJobDocumentType',
        { id, docType },
        { map: 'documentUpdate', id },
        { silent: true }
      );
    }
  },

  updateJobDocument: (id, patch) => {
    const title = patch.title.trim();
    if (!title) return;
    set((s) => ({
      jobDocuments: s.jobDocuments.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              title,
              body: doc.kind === 'text' ? patch.body : doc.body,
              docType: patch.docType,
            }
          : doc
      ),
    }));
    if (backendActive(get())) {
      const doc = get().jobDocuments.find((d) => d.id === id);
      write(
        'updateJobDocument',
        { id, title, body: doc?.body, docType: patch.docType },
        { map: 'documentUpdate', id }
      );
    }
  },

  deleteJobDocument: (id) => {
    const doc = get().jobDocuments.find((d) => d.id === id);
    if (!doc) return;
    set((s) => ({
      jobDocuments: s.jobDocuments.filter((d) => d.id !== id),
    }));
    if (backendActive(get())) {
      write(
        'deleteJobDocument',
        { id, storagePath: doc.storagePath },
        { map: 'documentDelete', id }
      );
    }
  },

  addJobIssue: (input) => {
    const state = get();
    const me = currentWorkerOf(state);
    if (!me) return null;
    const isBackend = backendActive(state);
    const created: JobIssue = {
      id: isBackend ? uuid() : `iss-${nextIssueId++}`,
      jobId: input.jobId,
      workRequestId: input.workRequestId,
      taskId: input.taskId,
      workerId: me.id,
      description: '',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    set({ jobIssues: [created, ...state.jobIssues] });
    if (isBackend) {
      write('insertJobIssue', created, { map: 'issueUpsert', id: created.id });
    }
    return created;
  },

  updateJobIssueDescription: (id, description) => {
    const before = get().jobIssues.find((issue) => issue.id === id);
    let updated: JobIssue | undefined;
    set((state) => ({
      jobIssues: state.jobIssues.map((issue) => {
        if (issue.id !== id) return issue;
        updated = { ...issue, description };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) {
      // Inline typing commit — no pill.
      write('updateJobIssue', updated, { map: 'issueUpsert', id }, {
        silent: true,
      });
    }
    // Issues are created EMPTY and described afterwards, so the "new issue"
    // ping fires on the first real description (once), not on the blank
    // insert — the office would otherwise get a contentless notification.
    if (
      updated &&
      before &&
      !before.description.trim() &&
      updated.description.trim()
    ) {
      const state = get();
      const recipients = new Set([
        ...idsWithRole(state.workers, 'scheduler'),
        ...jobFieldSuperIds(state, updated.jobId),
      ]);
      recipients.delete(updated.workerId);
      if (recipients.size > 0) {
        const raiser = state.workers.find((w) => w.id === updated!.workerId);
        // "PO · work request name" — the job alone when the issue predates
        // per-work-request issues (or its card is gone).
        const issueCard = updated.workRequestId
          ? state.workRequests.find((c) => c.id === updated!.workRequestId)
          : undefined;
        get().pushNotification({
          recipientIds: [...recipients],
          type: 'issue_raised',
          title:
            (issueCard
              ? workRequestNotificationTitle(state, updated.jobId, issueCard.title)
              : jobNotificationTitle(state, updated.jobId)) || 'New issue raised',
          body: `${updated.description.trim()}${
            raiser ? ` — ${raiser.name}` : ''
          }`,
          data: { jobId: updated.jobId, workRequestId: updated.workRequestId },
        });
      }
    }
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
    if (backendActive(get()) && updated) {
      write('updateJobIssue', updated, { map: 'issueUpsert', id });
    }
    // Resolution pings the job's Field Supers (minus the resolver). Reopening
    // stays silent — it reads as a correction, not an event.
    if (resolved && updated) {
      const state = get();
      const recipients = jobFieldSuperIds(state, updated.jobId).filter(
        (wid) => wid !== me?.id
      );
      if (recipients.length > 0) {
        const issueCard = updated.workRequestId
          ? state.workRequests.find((c) => c.id === updated!.workRequestId)
          : undefined;
        const description = updated.description.trim();
        get().pushNotification({
          recipientIds: recipients,
          type: 'issue_resolved',
          title:
            (issueCard
              ? workRequestNotificationTitle(state, updated.jobId, issueCard.title)
              : jobNotificationTitle(state, updated.jobId)) || 'Issue resolved',
          body: `Resolved${me ? ` by ${me.name}` : ''}${
            description ? ` — ${description}` : ''
          }`,
          data: { jobId: updated.jobId, workRequestId: updated.workRequestId },
        });
      }
    }
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
    if (backendActive(get())) {
      write('deleteJobIssue', id, { map: 'issueDelete', id });
    }
  },

  markTimesheetsSent: () => {
    set((state) => ({
      // The weekly server sweep delivered these to QuickBooks Time. (A real
      // per-log failure path sets 'failed'; that happens server-side in Step 7.)
      logs: state.logs.map((log) =>
        log.sendStatus === 'sent' ? log : { ...log, sendStatus: 'sent' }
      ),
    }));
    if (backendActive(get())) write('markTimesheetsSentRemote', null);
    // Ping the money-facing roles that the weekly push ran. NOTE: once the
    // sweep is fully server-side this action may never run on a client — the
    // server job should then insert these notification rows itself.
    const state = get();
    const recipients = [
      ...idsWithRole(state.workers, 'operator'),
      ...idsWithRole(state.workers, 'finance_manager'),
    ];
    if (recipients.length > 0) {
      get().pushNotification({
        recipientIds: recipients,
        type: 'qbt_push_result',
        title: 'Timesheets pushed to QuickBooks Time',
        body: 'The weekly timesheet push to QuickBooks Time has run.',
      });
    }
  },

  pushNotification: (input) => {
    const state = get();
    const createdAt = new Date().toISOString();
    if (backendActive(state)) {
      // One row per recipient; realtime fans each out to its owner's session.
      for (const recipientId of input.recipientIds) {
        write('insertNotification', {
          id: uuid(),
          recipientId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data,
          read: false,
          createdAt,
        });
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
    if (backendActive(get())) write('markNotificationRead', id);
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
      write('markAllNotificationsRead', me.id);
    }
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
    if (backendActive(get())) write('deleteNotification', id);
  },

  clearAllNotifications: () => {
    const me = currentWorkerOf(get());
    if (!me) return;
    set((state) => ({
      notifications: state.notifications.filter(
        (n) => n.recipientId !== me.id
      ),
    }));
    if (backendActive(get())) write('deleteAllNotifications', me.id);
  },

  toggleNotificationTypeMuted: (type) => {
    const muted = get().mutedNotificationTypes;
    const next = muted.includes(type)
      ? muted.filter((t) => t !== type)
      : [...muted, type];
    set({ mutedNotificationTypes: next });
    AsyncStorage.setItem(MUTED_TYPES_KEY, JSON.stringify(next)).catch(() => {});
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

// --- Theme preference (device-local) ------------------------------------------

const THEME_KEY = 'oxwh.theme';

// Apply the saved theme at launch. Runs async — the first frames render dark
// (the default); a saved 'light' flips the tree as soon as the read lands.
void AsyncStorage.getItem(THEME_KEY)
  .then((saved) => {
    if (saved === 'light' || saved === 'dark') {
      useAppStore.getState().setTheme(saved);
    }
  })
  .catch(() => {});

// --- Notification mutes (device-local) ----------------------------------------

const MUTED_TYPES_KEY = 'oxwh.mutedNotificationTypes';

// Restore this device's muted notification types at launch (see
// toggleNotificationTypeMuted for the write side).
void AsyncStorage.getItem(MUTED_TYPES_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      useAppStore.setState({
        mutedNotificationTypes: parsed.filter(
          (t): t is NotificationType => typeof t === 'string'
        ),
      });
    }
  })
  .catch(() => {});

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
      const storagePath = `${next.jobId}/${next.id}.${next.isVideo ? 'mp4' : 'jpg'}`;
      try {
        await backend.uploadJobPhoto(
          next.localUri,
          storagePath,
          next.isVideo ? 'video/mp4' : 'image/jpeg'
        );
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
          workRequestId: current.workRequestId,
          issueId: current.issueId,
          taskId: current.taskId,
          workerId: current.workerId,
          storagePath,
          url: backend.jobPhotoUrl(storagePath),
          note: current.note,
          takenAt: current.takenAt,
          isVideo: current.isVideo,
          sgdVideo: current.sgdVideo,
          photoType: current.photoType,
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
        if (!looksLikeNetworkError(e)) {
          // The server REJECTED this photo (policy / bad row) — a retry can
          // never succeed and would jam everything behind it. Drop it and
          // tell the photographer.
          console.error('Job photo rejected by the server; dropped:', e);
          notifySaveFailed(next.workerId, 'photo');
          useAppStore.setState((s) => ({
            pendingPhotos: s.pendingPhotos.filter((p) => p.id !== next.id),
          }));
          persistPendingPhotos(useAppStore.getState().pendingPhotos);
          void discardPhotoFile(next.localUri);
          continue;
        }
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
 * The crew ids an installer is working under on `date`. A Daily Crew they're
 * in takes priority on any day it actually HAS work scheduled: those days the
 * installer sees only the daily crew's assignments, not their Permanent
 * Crew's. In more than one working daily crew → all of them (they see the
 * union of that work). No working daily crew → their Permanent Crew as
 * normal. Empty when they're on no crew at all.
 *
 * (Daily crews used to be pinned to a stored date; since 2026-08 the
 * override days derive purely from the schedule — an idle daily crew does
 * nothing.)
 */
export function activeCrewIdsFor(
  state: {
    crews: Crew[];
    dailyCrews: DailyCrew[];
    assignments: ScheduleAssignment[];
  },
  installerId: string,
  date: string
): string[] {
  const workingDailies = state.dailyCrews.filter(
    (dc) =>
      dc.installerIds.includes(installerId) &&
      state.assignments.some((a) => a.crewId === dc.id && a.date === date)
  );
  if (workingDailies.length > 0) return workingDailies.map((dc) => dc.id);
  const permanent = state.crews.find((c) =>
    c.installerIds.includes(installerId)
  );
  return permanent ? [permanent.id] : [];
}

/**
 * The jobs a Field Super may see: only those they're assigned to via
 * {@link Job.fieldSuperIds}. A job with no Field Supers is visible to nobody.
 * Used by both Field Super screens so "own jobs only" (and, transitively, "own
 * work requests only") is enforced in one place.
 */
export function jobsForFieldSuper(jobs: Job[], fieldSuperId: string): Job[] {
  return jobs.filter((job) => job.fieldSuperIds?.includes(fieldSuperId));
}

/** Work Request ids assigned to a given crew on a given date. */
export function workRequestIdsForCrewOnDate(
  state: { assignments: ScheduleAssignment[] },
  crewId: string,
  date: string
): string[] {
  return state.assignments
    .filter((a) => a.crewId === crewId && a.date === date)
    .map((a) => a.workRequestId);
}

/**
 * Convenience: the Work Requests an installer should see on `date` =
 * assignments to their active crew(s) that day (the union, when several
 * daily crews of theirs are working).
 */
export function workRequestsForInstallerOnDate(
  state: {
    crews: Crew[];
    dailyCrews: DailyCrew[];
    assignments: ScheduleAssignment[];
    workRequests: WorkRequest[];
  },
  installerId: string,
  date: string
): WorkRequest[] {
  const crewIds = activeCrewIdsFor(state, installerId, date);
  if (crewIds.length === 0) return [];
  const ids = new Set(
    crewIds.flatMap((crewId) => workRequestIdsForCrewOnDate(state, crewId, date))
  );
  return state.workRequests.filter((card) => ids.has(card.id));
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
    if (activeCrewIdsFor(state, installerId, a.date).includes(a.crewId)) {
      dates.add(a.date);
    }
  }
  return dates;
}

/**
 * The distinct parent Jobs a worker has clocked into, most recent first (the
 * currently running shift counts as most recent of all). Clock-ins reference
 * work requests, so each log resolves work request → parent job; custom-project logs (no
 * work request) can't resolve to a job and are skipped.
 */
export function recentClockedJobs(
  state: {
    logs: TimesheetLog[];
    workRequests: WorkRequest[];
    jobs: Job[];
    activeShift: ActiveShift | null;
  },
  workerId: string,
  limit = 10
): Job[] {
  const workRequestIds: string[] = [];
  if (state.activeShift?.workRequestId) {
    workRequestIds.push(state.activeShift.workRequestId);
  }
  const logs = state.logs
    .filter((l) => l.workerId === workerId && l.workRequestId)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  for (const log of logs) workRequestIds.push(log.workRequestId!);

  const result: Job[] = [];
  const seen = new Set<string>();
  for (const cardId of workRequestIds) {
    if (result.length >= limit) break;
    const jobId = state.workRequests.find((c) => c.id === cardId)?.jobId;
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
