import { format } from 'date-fns';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
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
  ReviewStatus,
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
 * Default session until real auth lands: desktop roles (Scheduler/Operator) are
 * used on web, so open web to the Operator; native is the Installer app.
 */
const defaultCurrentUserId = Platform.OS === 'web' ? 'w-op' : PRIMARY_INSTALLER_ID;

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
  /** Who is "logged in" — drives which interface renders. */
  currentUserId: string;
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

  /** Switch the active session (dev "View as" switcher; later: real auth). */
  setCurrentUser: (id: string) => void;
  /** Edit the current worker's own profile. */
  updateUser: (changes: Partial<Worker>) => void;

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
  /** Create a Jobcard. Inherits flashingMaterial from the parent Job. */
  addJobcard: (
    card: Omit<Jobcard, 'id' | 'status' | 'priorityOrder' | 'flashingMaterial'> & {
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

  // --- Timesheet review pipeline (Operator) ---
  /** Move a single timesheet through pending → approved → synced. */
  setLogReviewStatus: (logId: string, status: ReviewStatus) => void;
  /** Flag all currently-approved timesheets as synced to QuickBooks Time. */
  sendApprovedToQbt: () => void;

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
  currentUserId: defaultCurrentUserId,
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

  setCurrentUser: (id) => set({ currentUserId: id }),

  updateUser: (changes) =>
    set((state) => ({
      workers: state.workers.map((w) =>
        w.id === state.currentUserId ? { ...w, ...changes } : w
      ),
    })),

  addWorker: (worker) => {
    const created: Worker = {
      status: 'invited',
      ...worker,
      id: worker.id ?? `w-${nextWorkerId++}`,
    };
    set((state) => ({ workers: [...state.workers, created] }));
    return created;
  },

  updateWorker: (id, changes) =>
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, ...changes } : w)),
    })),

  setWorkerRole: (id, role) =>
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, role } : w)),
    })),

  setWorkerRate: (id, hourlyRate) =>
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, hourlyRate } : w)),
    })),

  addJob: (job) => {
    const created: Job = {
      status: 'Active',
      ...job,
      id: job.id ?? `job-${nextJobId++}`,
    };
    set((state) => ({ jobs: [created, ...state.jobs] }));
    return created;
  },

  updateJob: (id, changes) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...changes } : job)),
    })),

  addJobcard: (card) => {
    const state = get();
    // Snapshot the parent Job's flashing material onto the card at creation
    // time (auto-inheritance). A later Job edit must not mutate existing cards.
    const parentJob = card.jobId
      ? state.jobs.find((job) => job.id === card.jobId)
      : undefined;
    // Default the intra-day sort key to one past the busiest card on that date.
    const maxOrderOnDate = state.jobcards
      .filter((c) => c.date === card.date)
      .reduce((max, c) => Math.max(max, c.priorityOrder), 0);
    const created: Jobcard = {
      ...card,
      id: card.id ?? `jc-${nextJobcardId++}`,
      status: card.status ?? 'Upcoming',
      priority: card.priority ?? 'Medium',
      priorityOrder: card.priorityOrder ?? maxOrderOnDate + 1,
      flashingMaterial: parentJob?.flashingMaterial,
    };
    set({ jobcards: [created, ...state.jobcards] });
    return created;
  },

  updateJobcard: (id, changes) =>
    set((state) => ({
      jobcards: state.jobcards.map((card) =>
        card.id === id ? { ...card, ...changes } : card
      ),
    })),

  updateJobcardNotes: (id, fieldNotes) =>
    set((state) => ({
      jobcards: state.jobcards.map((card) =>
        card.id === id ? { ...card, fieldNotes } : card
      ),
    })),

  setJobcardStatus: (jobcardId, status) =>
    set((state) => ({
      jobcards: state.jobcards.map((card) =>
        card.id === jobcardId ? { ...card, status } : card
      ),
    })),

  addCrew: (crew) => {
    const state = get();
    const created: Crew = {
      ...crew,
      id: crew.id ?? `crew-${nextCrewId++}`,
      installerIds: onlyInstallerIds(state.workers, crew.installerIds),
    };
    set({ crews: [...state.crews, created] });
    return created;
  },

  updateCrew: (id, changes) =>
    set((state) => ({
      crews: state.crews.map((crew) =>
        crew.id === id
          ? {
              ...crew,
              ...changes,
              installerIds: changes.installerIds
                ? onlyInstallerIds(state.workers, changes.installerIds)
                : crew.installerIds,
            }
          : crew
      ),
    })),

  removeCrew: (id) =>
    set((state) => ({ crews: state.crews.filter((crew) => crew.id !== id) })),

  addDailyCrew: (crew) => {
    const state = get();
    const created: DailyCrew = {
      ...crew,
      id: crew.id ?? `dc-${nextDailyCrewId++}`,
      installerIds: onlyInstallerIds(state.workers, crew.installerIds),
    };
    set({ dailyCrews: [...state.dailyCrews, created] });
    return created;
  },

  updateDailyCrew: (id, changes) =>
    set((state) => ({
      dailyCrews: state.dailyCrews.map((crew) =>
        crew.id === id
          ? {
              ...crew,
              ...changes,
              installerIds: changes.installerIds
                ? onlyInstallerIds(state.workers, changes.installerIds)
                : crew.installerIds,
            }
          : crew
      ),
    })),

  removeDailyCrew: (id) =>
    set((state) => ({
      dailyCrews: state.dailyCrews.filter((crew) => crew.id !== id),
    })),

  assignJobcard: (jobcardId, crewId, date) => {
    const state = get();
    // Idempotent: a repeated drop of the same card onto the same crew/date must
    // not create a duplicate — keep the source of truth single.
    const existing = state.assignments.find(
      (a) => a.jobcardId === jobcardId && a.crewId === crewId && a.date === date
    );
    if (existing) return existing;
    const created: ScheduleAssignment = {
      id: `asn-${nextAssignmentId++}`,
      jobcardId,
      crewId,
      date,
    };
    set({ assignments: [...state.assignments, created] });
    return created;
  },

  unassignJobcard: (assignmentId) =>
    set((state) => ({
      assignments: state.assignments.filter((a) => a.id !== assignmentId),
    })),

  clockIn: (ref) =>
    set({
      activeShift: { ...ref, startTime: new Date().toISOString() },
    }),

  clockOut: () => {
    const state = get();
    if (!state.activeShift) return null;
    const end = new Date();
    const totalHours = hoursBetween(
      state.activeShift.startTime,
      end.toISOString()
    );
    const log: TimesheetLog = {
      id: `t-${nextLogId++}`,
      workerId: state.currentUserId,
      date: format(new Date(state.activeShift.startTime), 'yyyy-MM-dd'),
      jobcardId: state.activeShift.jobcardId,
      customProjectName: state.activeShift.customProjectName,
      startTime: state.activeShift.startTime,
      endTime: end.toISOString(),
      totalHours,
      earnedAmount:
        Math.round(
          totalHours * rateForWorker(state.workers, state.currentUserId) * 100
        ) / 100,
      reviewStatus: 'pending',
    };
    set({ activeShift: null, logs: [log, ...state.logs] });
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

  updateLog: (logId, changes) =>
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
          // An edit invalidates any prior approval — back to the review queue.
          updated.reviewStatus = 'pending';
          return updated;
        }),
      };
    }),

  deleteLog: (logId) =>
    set((state) => {
      const sync = { ...state.qbt.sync };
      delete sync[logId];
      return {
        logs: state.logs.filter((log) => log.id !== logId),
        qbt: { ...state.qbt, sync },
      };
    }),

  addLog: (entry) => {
    const state = get();
    const totalHours = hoursBetween(entry.startTime, entry.endTime);
    const log: TimesheetLog = {
      id: `t-${nextLogId++}`,
      workerId: state.currentUserId,
      date: format(new Date(entry.startTime), 'yyyy-MM-dd'),
      jobcardId: entry.jobcardId,
      customProjectName: entry.customProjectName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      totalHours,
      earnedAmount:
        Math.round(
          totalHours * rateForWorker(state.workers, state.currentUserId) * 100
        ) / 100,
      reviewStatus: 'pending',
    };
    set({ logs: [log, ...state.logs] });
    return log;
  },

  setLogReviewStatus: (logId, status) =>
    set((state) => ({
      logs: state.logs.map((log) =>
        log.id === logId ? { ...log, reviewStatus: status } : log
      ),
    })),

  sendApprovedToQbt: () =>
    set((state) => ({
      // UI hook for now: flag approved hours as synced. The actual QBT payload
      // is sent by the weekly server-side push once the backend is wired.
      logs: state.logs.map((log) =>
        log.reviewStatus === 'approved' ? { ...log, reviewStatus: 'synced' } : log
      ),
    })),

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

/** Resolve the active session's worker record (falls back to the first worker). */
export function currentWorkerOf(state: {
  workers: Worker[];
  currentUserId: string;
}): Worker {
  return (
    state.workers.find((w) => w.id === state.currentUserId) ?? state.workers[0]
  );
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

/** Hook: the worker for the active session. Re-renders on switch or edit. */
export function useCurrentWorker(): Worker {
  return useAppStore((s) => currentWorkerOf(s));
}

/** Hook: just the active session's role — handy for routing/gating. */
export function useCurrentRole(): AppRole {
  return useAppStore((s) => currentWorkerOf(s).role);
}
