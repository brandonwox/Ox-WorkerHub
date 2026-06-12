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
  /** ISO datetime string */
  startTime: string;
  /** ISO datetime string */
  endTime: string;
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
  notes?: string;
}

export interface ActiveShift {
  jobId?: string;
  customProjectName?: string;
  /** ISO datetime string */
  startTime: string;
}
