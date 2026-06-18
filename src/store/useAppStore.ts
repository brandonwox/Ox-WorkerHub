import { format } from 'date-fns';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  DEVELOPER_ID,
  mockAssignments,
  mockCrews,
  mockDailyCrews,
  mockJobcards,
  mockJobs,
  mockLogs,
  mockWorkers,
  PRIMARY_INSTALLER_ID,
} from '@/data/mock';
import {
  defaultJobcodeId,
  defaultJobcodeMap,
  defaultQbtConfig,
} from '@/integrations/quickbooksTime/config';
import * as backend from '@/integrations/supabase/data';
import {
  ActiveShift,
  AppRole,
  Crew,
  DailyCrew,
  Job,
  Jobcard,
  JobcardStatus,
  JobStatus,
  QbtConfig,
  QbtConnection,
  QbtJobcode,
  QbtSyncRecord,
  ScheduleAssignment,
  TimesheetLog,
  TimesheetSendStatus,
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

/** Fire-and-forget a Supabase write; surface failures without breaking the UI. */
function write(p: Promise<unknown>): void {
  p.catch((e) => console.warn('Supabase write failed:', e));
}

/** RFC4122-ish v4 id for new records in backend mode (DB columns are uuid). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Which real role the Developer views as by default: web opens to a desktop role
 * (Operator), native to the Installer app. (The base identity is the Developer;
 * this is just the initial impersonation target.)
 */
const defaultViewAsId = Platform.OS === 'web' ? 'w-op' : PRIMARY_INSTALLER_ID;

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

interface AppState {
  /** Full roster across all roles (seeded now, Supabase-backed later). */
  workers: Worker[];
  /**
   * Dev-mode base identity (a mock worker id) — the Developer. Used only when
   * not signed in via Supabase (`authWorker` is null).
   */
  devBaseUserId: string;
  /**
   * The real signed-in worker, resolved from the Supabase session. When set it
   * IS the base identity, overriding `devBaseUserId`.
   */
  authWorker: Worker | null;
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
  activeShift: ActiveShift | null;
  qbt: QbtState;

  /** Developer-only "View as": impersonate a role for the UI (or null for none). */
  setViewAs: (userId: string | null) => void;
  /** Set/clear the real signed-in worker (Supabase auth bootstrap). */
  setAuthWorker: (worker: Worker | null) => void;
  /** Edit the current (effective) worker's own profile. */
  updateUser: (changes: Partial<Worker>) => void;

  // --- Backend hydration (Supabase store swap, Step 7d) ---
  /** Replace every collection with live Supabase data (on real sign-in). */
  loadBackendData: () => Promise<void>;
  /** Restore the in-memory mock data (on sign-out / dev mode). */
  resetToMockData: () => void;

  // --- Worker management (Operator) ---
  /** Add a worker to the roster. Returns the created record. */
  addWorker: (worker: Omit<Worker, 'id' | 'status'> & { id?: string }) => Worker;
  updateWorker: (id: string, changes: Partial<Worker>) => void;
  setWorkerRole: (id: string, role: AppRole) => void;
  setWorkerRate: (id: string, hourlyRate: number) => void;

  // --- Jobs (jobsites — Operator) ---
  /** Create a jobsite. Returns the created record. */
  addJob: (job: Omit<Job, 'id' | 'status'> & { id?: string; status?: JobStatus }) => Job;
  updateJob: (id: string, changes: Partial<Job>) => void;

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
  /** Installer-facing: append/replace shared field notes on a Jobcard. */
  updateJobcardNotes: (id: string, fieldNotes: string) => void;
  setJobcardStatus: (jobcardId: string, status: JobcardStatus) => void;

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

  // --- Timesheets → QuickBooks Time (Operator visibility) ---
  /**
   * Reflect a successful weekly sweep by flagging every un-sent/failed timesheet
   * as 'sent'. There is no in-app approval — approval happens inside QBT. Called
   * by the server-side sweep (Step 7); no user-facing button.
   */
  markTimesheetsSent: () => void;

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
let nextCrewId = 100;
let nextDailyCrewId = 100;
let nextAssignmentId = 100;

export const useAppStore = create<AppState>((set, get) => ({
  workers: mockWorkers,
  devBaseUserId: DEVELOPER_ID,
  authWorker: null,
  viewAsUserId: defaultViewAsId,
  jobs: mockJobs,
  jobcards: mockJobcards,
  crews: mockCrews,
  dailyCrews: mockDailyCrews,
  assignments: mockAssignments,
  logs: mockLogs,
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

  setAuthWorker: (worker) => set({ authWorker: worker }),

  loadBackendData: async () => {
    const data = await backend.fetchAllData();
    set({
      workers: data.workers,
      jobs: data.jobs,
      jobcards: data.jobcards,
      crews: data.crews,
      dailyCrews: data.dailyCrews,
      assignments: data.assignments,
      logs: data.logs,
    });
  },

  resetToMockData: () =>
    set({
      workers: mockWorkers,
      jobs: mockJobs,
      jobcards: mockJobcards,
      crews: mockCrews,
      dailyCrews: mockDailyCrews,
      assignments: mockAssignments,
      logs: mockLogs,
    }),

  updateUser: (changes) => {
    let updated: Worker | undefined;
    set((state) => {
      const me = currentWorkerOf(state);
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
    if (backendActive(get()) && updated) write(backend.updateWorker(updated));
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
    if (backendActive(get()) && updated) write(backend.updateWorker(updated));
  },

  addJob: (job) => {
    const isBackend = backendActive(get());
    const created: Job = {
      status: 'Active',
      ...job,
      id: job.id ?? (isBackend ? uuid() : `job-${nextJobId++}`),
    };
    set((state) => ({ jobs: [created, ...state.jobs] }));
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
    if (backendActive(get()) && updated) write(backend.updateJob(updated));
  },

  addJobcard: (card) => {
    const state = get();
    // Default the card's flashing material to the parent Job's value, snapshotted
    // at creation time (a later Job edit must not mutate existing cards). The PM
    // may pass an explicit override, which wins over the inherited value.
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
      status: card.status ?? 'Upcoming',
      priority: card.priority ?? 'Medium',
      priorityOrder: card.priorityOrder ?? maxOrderOnDate + 1,
      flashingMaterial:
        card.flashingMaterial !== undefined
          ? card.flashingMaterial
          : parentJob?.flashingMaterial,
    };
    set({ jobcards: [created, ...state.jobcards] });
    if (isBackend) write(backend.insertJobcard(created));
    return created;
  },

  updateJobcard: (id, changes) => {
    let updated: Jobcard | undefined;
    set((state) => ({
      jobcards: state.jobcards.map((card) => {
        if (card.id !== id) return card;
        updated = { ...card, ...changes };
        return updated;
      }),
    }));
    if (backendActive(get()) && updated) write(backend.updateJobcard(updated));
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
    return created;
  },

  unassignJobcard: (assignmentId) => {
    set((state) => ({
      assignments: state.assignments.filter((a) => a.id !== assignmentId),
    }));
    if (backendActive(get())) write(backend.deleteAssignment(assignmentId));
  },

  clockIn: (ref) =>
    set({
      activeShift: { ...ref, startTime: new Date().toISOString() },
    }),

  clockOut: () => {
    const state = get();
    if (!state.activeShift) return null;
    const me = currentWorkerOf(state);
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

/** The identity-resolving slice of state (shared by the selectors below). */
type IdentityState = {
  workers: Worker[];
  devBaseUserId: string;
  authWorker: Worker | null;
  viewAsUserId: string | null;
};

/**
 * The real signed-in identity: the Supabase auth worker if present, otherwise
 * the dev base (the Developer). This is what gates the "View as" switcher.
 */
export function baseWorkerOf(state: IdentityState): Worker {
  return (
    state.authWorker ??
    state.workers.find((w) => w.id === state.devBaseUserId) ??
    state.workers[0]
  );
}

/**
 * The identity the UI renders as. Only the Developer can impersonate: when the
 * base role is `developer` and a `viewAsUserId` is set, that worker is returned;
 * for everyone else the effective identity is simply themselves.
 */
export function currentWorkerOf(state: IdentityState): Worker {
  const base = baseWorkerOf(state);
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

/** Hook: the effective worker (impersonated for the Developer, else self). */
export function useCurrentWorker(): Worker {
  return useAppStore((s) => currentWorkerOf(s));
}

/** Hook: the effective role — handy for routing/gating. */
export function useCurrentRole(): AppRole {
  return useAppStore((s) => currentWorkerOf(s).role);
}

/** Hook: true when the real (base) identity is the Developer — gates the switcher. */
export function useIsDeveloper(): boolean {
  return useAppStore((s) => baseWorkerOf(s).role === 'developer');
}
