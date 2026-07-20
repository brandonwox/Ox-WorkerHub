import { jobcodeKeyFor, useAppStore } from '@/store/useAppStore';
import { QbtSyncRecord, TimesheetLog } from '@/types';

import {
  QbtApiError,
  createTimesheet,
  getCurrentUser,
  updateTimesheet,
} from './client';

function store() {
  return useAppStore.getState();
}

function errorMessage(e: unknown): string {
  if (e instanceof QbtApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error talking to QuickBooks Time.';
}

/**
 * Resolve the QBT jobcode a log should book to. Precedence per the blueprint
 * financial lifecycle:
 *   1. log → work request → parent Job's `qbtJobcodeId` (the intended path),
 *   2. else the explicit `qbt.jobcodeMap` entry for this project key,
 *   3. else `qbt.defaultJobcodeId`.
 * Custom-named logs (no work request) skip step 1 and use the map/default.
 */
export function resolveJobcodeId(log: TimesheetLog): number | undefined {
  const { qbt, workRequests, jobs } = store();

  // 1. Climb to the parent Job and use its mapped jobcode if set.
  if (log.workRequestId) {
    const card = workRequests.find((j) => j.id === log.workRequestId);
    const job = card?.jobId ? jobs.find((j) => j.id === card.jobId) : undefined;
    if (job?.qbtJobcodeId) {
      const id = Number(job.qbtJobcodeId);
      if (Number.isFinite(id)) return id;
    }
  }

  // 2. Explicit per-project mapping. 3. Default fallback.
  const key = jobcodeKeyFor(log);
  if (key && qbt.jobcodeMap[key] !== undefined) return qbt.jobcodeMap[key];
  return qbt.defaultJobcodeId;
}

/** Human-facing project name, used as the QBT timesheet note. */
function projectNameFor(log: TimesheetLog): string {
  const { workRequests } = store();
  if (log.workRequestId)
    return workRequests.find((j) => j.id === log.workRequestId)?.title ?? 'Work Request';
  return log.customProjectName ?? 'Custom Project';
}

function setRecord(logId: string, record: QbtSyncRecord): void {
  store().setQbtSyncRecord(logId, record);
}

/** Whether the integration is configured enough to push anything. */
export function isQbtReady(): boolean {
  const { qbt } = store();
  return Boolean(qbt.config.accessToken && qbt.connection);
}

/**
 * Establish the QuickBooks Time connection from the baked-in token (app.json ->
 * expo.extra.quickbooksTime.accessToken). Looks up the account identity and the
 * payroll approval window so auto-sync knows which QBT user to file hours under.
 * Safe to call on every launch: no-ops when there's no token or we're already
 * connected, and swallows errors (the integration just stays idle).
 */
export async function ensureQbtConnection(): Promise<void> {
  const { qbt } = store();
  if (!qbt.config.accessToken || qbt.connection) return;
  try {
    const { connection, submittedThrough, approvedThrough } =
      await getCurrentUser(qbt.config);
    store().setQbtConnection(connection);
    store().setQbtApprovalWindow(submittedThrough, approvedThrough);
  } catch {
    // Leave the integration idle; hours stay queued locally until next launch.
  }
}

/**
 * Push a single timecard to QuickBooks Time. Creates a new timesheet, or
 * updates the existing one if this log has been pushed before. Resolves to the
 * resulting sync record (also written into the store).
 */
export async function submitLog(logId: string): Promise<QbtSyncRecord> {
  const state = store();
  const log = state.logs.find((l) => l.id === logId);
  if (!log) {
    return { status: 'error', error: 'Timecard not found.' };
  }

  const { config, connection } = state.qbt;
  if (!config.accessToken || !connection) {
    const rec: QbtSyncRecord = {
      status: 'error',
      error: 'QuickBooks Time is not connected.',
    };
    setRecord(logId, rec);
    return rec;
  }

  const jobcodeId = resolveJobcodeId(log);
  if (jobcodeId === undefined) {
    const rec: QbtSyncRecord = {
      status: 'error',
      error: 'No QuickBooks Time jobcode mapped for this project.',
    };
    setRecord(logId, rec);
    return rec;
  }

  const existingId = state.qbt.sync[logId]?.qbtTimesheetId;
  setRecord(logId, { status: 'syncing', qbtTimesheetId: existingId });

  const input = {
    userId: connection.userId,
    jobcodeId,
    start: log.startTime,
    end: log.endTime,
    notes: projectNameFor(log),
  };

  try {
    let timesheetId: number;
    if (existingId) {
      await updateTimesheet(config, existingId, input);
      timesheetId = existingId;
    } else {
      timesheetId = await createTimesheet(config, input);
    }
    const approvedThrough = store().qbt.approvedThrough;
    const approved = approvedThrough ? log.date <= approvedThrough : false;
    const rec: QbtSyncRecord = {
      status: approved ? 'approved' : 'submitted',
      qbtTimesheetId: timesheetId,
      lastSyncedAt: new Date().toISOString(),
    };
    setRecord(logId, rec);
    return rec;
  } catch (e) {
    const rec: QbtSyncRecord = {
      status: 'error',
      qbtTimesheetId: existingId,
      error: errorMessage(e),
    };
    setRecord(logId, rec);
    return rec;
  }
}

/**
 * Auto-push a freshly logged timecard. Silent: when QuickBooks Time isn't
 * connected this is a no-op, and any failure is captured in the log's sync
 * record without surfacing to the worker. The payroll manager reviews and
 * approves the resulting timesheet inside QuickBooks Time itself.
 */
export function maybeAutoSync(log: TimesheetLog): void {
  const { qbt } = store();
  if (!qbt.config.autoSync || !isQbtReady()) return;
  // Fire-and-forget; status lives in the store for diagnostics.
  void submitLog(log.id);
}
