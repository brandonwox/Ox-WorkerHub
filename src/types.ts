export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  tradeRole: string;
  hourlyRate: number;
}

export type JobStatus = 'Upcoming' | 'In Progress' | 'Finished';

export interface Job {
  id: string;
  title: string;
  address: string;
  /** Scheduled calendar day (yyyy-MM-dd). Always set. */
  date: string;
  /**
   * Optional time window the worker is expected on site. Most jobs won't have
   * one assigned — the office side can set it when a window matters.
   * ISO datetime string.
   */
  startTime?: string;
  /** ISO datetime string. Set together with startTime. */
  endTime?: string;
  status: JobStatus;
  priorityOrder: number;
  details: {
    generalContractor: string;
    managerName: string;
    managerPhone: string;
  };
}

export interface TimesheetLog {
  id: string;
  /** ISO date string (yyyy-MM-dd) */
  date: string;
  jobId?: string;
  customProjectName?: string;
  /** ISO datetime string */
  startTime: string;
  /** ISO datetime string */
  endTime: string;
  totalHours: number;
  earnedAmount: number;
}

export interface ActiveShift {
  jobId?: string;
  customProjectName?: string;
  /** ISO datetime string */
  startTime: string;
}
