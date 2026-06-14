import {
  Crew,
  DailyCrew,
  Job,
  Jobcard,
  JobcardPriority,
  JobcardStatus,
  JobStatus,
  ScheduleAssignment,
  TimesheetLog,
  TimesheetSendStatus,
  Worker,
} from '@/types';

import { rowToWorker } from './auth';
import { getSupabase } from './client';

/**
 * Read layer for the Supabase store swap (Step 7d). Maps snake_case DB rows onto
 * the app's camelCase domain types and loads every collection in parallel. The
 * write layer (7d-2) reuses these same mappers in reverse.
 */

// --- Row shapes (DB columns) -------------------------------------------------

interface JobRow {
  id: string;
  name: string;
  location: string;
  status: string;
  qbt_jobcode_id: string | null;
  flashing_material: string | null;
}

interface JobcardRow {
  id: string;
  job_id: string | null;
  title: string;
  address: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: string;
  priority_order: number;
  flashing_material: string | null;
  materials: string | null;
  scope_of_work: string | null;
  field_notes: string | null;
  details: {
    generalContractor?: string;
    managerName?: string;
    managerPhone?: string;
  } | null;
}

interface CrewRow {
  id: string;
  name: string;
}
interface CrewMemberRow {
  crew_id: string;
  installer_id: string;
}
interface DailyCrewRow {
  id: string;
  date: string;
  name: string;
}
interface DailyCrewMemberRow {
  daily_crew_id: string;
  installer_id: string;
}

interface AssignmentRow {
  id: string;
  jobcard_id: string;
  crew_id: string;
  date: string;
}

interface TimesheetRow {
  id: string;
  worker_id: string;
  date: string;
  jobcard_id: string | null;
  custom_project_name: string | null;
  start_time: string;
  end_time: string;
  total_hours: number;
  earned_amount: number;
  send_status: string;
}

// --- Mappers (row -> domain) -------------------------------------------------

function rowToJob(r: JobRow): Job {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    status: r.status as JobStatus,
    qbtJobcodeId: r.qbt_jobcode_id ?? undefined,
    flashingMaterial: r.flashing_material ?? undefined,
  };
}

function rowToJobcard(r: JobcardRow): Jobcard {
  return {
    id: r.id,
    jobId: r.job_id ?? undefined,
    title: r.title,
    address: r.address,
    date: r.date,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    status: r.status as JobcardStatus,
    priority: r.priority as JobcardPriority,
    priorityOrder: r.priority_order,
    flashingMaterial: r.flashing_material ?? undefined,
    materials: r.materials ?? undefined,
    scopeOfWork: r.scope_of_work ?? undefined,
    fieldNotes: r.field_notes ?? undefined,
    details: {
      generalContractor: r.details?.generalContractor ?? '',
      managerName: r.details?.managerName ?? '',
      managerPhone: r.details?.managerPhone ?? '',
    },
  };
}

function rowToAssignment(r: AssignmentRow): ScheduleAssignment {
  return { id: r.id, jobcardId: r.jobcard_id, crewId: r.crew_id, date: r.date };
}

function rowToTimesheet(r: TimesheetRow): TimesheetLog {
  return {
    id: r.id,
    workerId: r.worker_id,
    date: r.date,
    jobcardId: r.jobcard_id ?? undefined,
    customProjectName: r.custom_project_name ?? undefined,
    startTime: r.start_time,
    endTime: r.end_time,
    totalHours: Number(r.total_hours),
    earnedAmount: Number(r.earned_amount),
    sendStatus: r.send_status as TimesheetSendStatus,
  };
}

// --- Bulk read ---------------------------------------------------------------

export interface BackendData {
  workers: Worker[];
  jobs: Job[];
  jobcards: Jobcard[];
  crews: Crew[];
  dailyCrews: DailyCrew[];
  assignments: ScheduleAssignment[];
  logs: TimesheetLog[];
}

/** Load every collection from Supabase (RLS-scoped to the caller). */
export async function fetchAllData(): Promise<BackendData> {
  const sb = getSupabase();

  const [
    workersR,
    jobsR,
    jobcardsR,
    crewsR,
    crewMembersR,
    dailyCrewsR,
    dailyCrewMembersR,
    assignmentsR,
    timesheetsR,
  ] = await Promise.all([
    sb.from('workers').select('*'),
    sb.from('jobs').select('*'),
    sb.from('jobcards').select('*'),
    sb.from('crews').select('*'),
    sb.from('crew_members').select('*'),
    sb.from('daily_crews').select('*'),
    sb.from('daily_crew_members').select('*'),
    sb.from('schedule_assignments').select('*'),
    sb.from('timesheets').select('*'),
  ]);

  const firstError =
    workersR.error ??
    jobsR.error ??
    jobcardsR.error ??
    crewsR.error ??
    crewMembersR.error ??
    dailyCrewsR.error ??
    dailyCrewMembersR.error ??
    assignmentsR.error ??
    timesheetsR.error;
  if (firstError) throw new Error(firstError.message);

  const crewMembers = (crewMembersR.data ?? []) as CrewMemberRow[];
  const crews: Crew[] = ((crewsR.data ?? []) as CrewRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    installerIds: crewMembers
      .filter((m) => m.crew_id === c.id)
      .map((m) => m.installer_id),
  }));

  const dailyMembers = (dailyCrewMembersR.data ?? []) as DailyCrewMemberRow[];
  const dailyCrews: DailyCrew[] = (
    (dailyCrewsR.data ?? []) as DailyCrewRow[]
  ).map((c) => ({
    id: c.id,
    date: c.date,
    name: c.name,
    installerIds: dailyMembers
      .filter((m) => m.daily_crew_id === c.id)
      .map((m) => m.installer_id),
  }));

  return {
    workers: ((workersR.data ?? []) as Parameters<typeof rowToWorker>[0][]).map(
      rowToWorker
    ),
    jobs: ((jobsR.data ?? []) as JobRow[]).map(rowToJob),
    jobcards: ((jobcardsR.data ?? []) as JobcardRow[]).map(rowToJobcard),
    crews,
    dailyCrews,
    assignments: ((assignmentsR.data ?? []) as AssignmentRow[]).map(
      rowToAssignment
    ),
    logs: ((timesheetsR.data ?? []) as TimesheetRow[]).map(rowToTimesheet),
  };
}
