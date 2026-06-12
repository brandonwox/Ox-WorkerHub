import { format } from 'date-fns';
import { create } from 'zustand';

import { mockJobs, mockLogs, mockUser } from '@/data/mock';
import { ActiveShift, Job, JobStatus, TimesheetLog, User } from '@/types';
import { hoursBetween } from '@/utils/time';

interface AppState {
  user: User;
  jobs: Job[];
  logs: TimesheetLog[];
  activeShift: ActiveShift | null;

  updateUser: (changes: Partial<User>) => void;
  setJobStatus: (jobId: string, status: JobStatus) => void;
  clockIn: (ref: { jobId?: string; customProjectName?: string }) => void;
  /** Ends the active shift and returns the generated log, or null if not clocked in. */
  clockOut: () => TimesheetLog | null;
  /** Adjusts the start time of the in-progress shift. */
  updateShiftStart: (startTime: string) => void;
  updateLog: (
    logId: string,
    changes: Pick<
      Partial<TimesheetLog>,
      'date' | 'jobId' | 'customProjectName' | 'startTime' | 'endTime'
    >
  ) => void;
  deleteLog: (logId: string) => void;
  /** Creates a manual timecard from explicit start/end times. */
  addLog: (entry: {
    jobId?: string;
    customProjectName?: string;
    startTime: string;
    endTime: string;
  }) => TimesheetLog;
}

let nextLogId = 100;

export const useAppStore = create<AppState>((set, get) => ({
  user: mockUser,
  jobs: mockJobs,
  logs: mockLogs,
  activeShift: null,

  updateUser: (changes) =>
    set((state) => ({ user: { ...state.user, ...changes } })),

  setJobStatus: (jobId, status) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId ? { ...job, status } : job
      ),
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
      date: format(new Date(state.activeShift.startTime), 'yyyy-MM-dd'),
      jobId: state.activeShift.jobId,
      customProjectName: state.activeShift.customProjectName,
      startTime: state.activeShift.startTime,
      endTime: end.toISOString(),
      totalHours,
      earnedAmount: Math.round(totalHours * state.user.hourlyRate * 100) / 100,
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

  updateLog: (logId, changes) =>
    set((state) => ({
      logs: state.logs.map((log) => {
        if (log.id !== logId) return log;
        const updated = { ...log, ...changes };
        updated.totalHours = hoursBetween(updated.startTime, updated.endTime);
        updated.earnedAmount =
          Math.round(updated.totalHours * state.user.hourlyRate * 100) / 100;
        return updated;
      }),
    })),

  deleteLog: (logId) =>
    set((state) => ({ logs: state.logs.filter((log) => log.id !== logId) })),

  addLog: (entry) => {
    const state = get();
    const totalHours = hoursBetween(entry.startTime, entry.endTime);
    const log: TimesheetLog = {
      id: `t-${nextLogId++}`,
      date: format(new Date(entry.startTime), 'yyyy-MM-dd'),
      jobId: entry.jobId,
      customProjectName: entry.customProjectName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      totalHours,
      earnedAmount: Math.round(totalHours * state.user.hourlyRate * 100) / 100,
    };
    set({ logs: [log, ...state.logs] });
    return log;
  },
}));
