import {
  Crew,
  DailyCrew,
  Job,
  Jobcard,
  JobcardPriority,
  JobcardStatus,
  JobScope,
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
  scopes: string[] | null;
  tasks: string[] | null;
  readiness: string | null;
  flashing_material: string | null;
  materials: string | null;
  notes: string | null;
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
    scopes: r.scopes ? (r.scopes as JobScope[]) : undefined,
    tasks: r.tasks ?? undefined,
    readiness: r.readiness ?? undefined,
    flashingMaterial: r.flashing_material ?? undefined,
    materials: r.materials ?? undefined,
    notes: r.notes ?? undefined,
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

// --- Write layer (domain -> row). INSERT and UPDATE are kept separate so an
//     update never trips a stricter INSERT RLS policy (e.g. self profile edits).

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function jobToRow(job: Job) {
  return {
    id: job.id,
    name: job.name,
    location: job.location,
    status: job.status,
    qbt_jobcode_id: job.qbtJobcodeId ?? null,
    flashing_material: job.flashingMaterial ?? null,
  };
}

export async function insertJob(job: Job): Promise<void> {
  check((await getSupabase().from('jobs').insert(jobToRow(job))).error);
}
export async function updateJob(job: Job): Promise<void> {
  check(
    (await getSupabase().from('jobs').update(jobToRow(job)).eq('id', job.id))
      .error
  );
}

function jobcardToRow(card: Jobcard) {
  return {
    id: card.id,
    job_id: card.jobId ?? null,
    title: card.title,
    address: card.address,
    date: card.date,
    start_time: card.startTime ?? null,
    end_time: card.endTime ?? null,
    status: card.status,
    priority: card.priority,
    priority_order: card.priorityOrder,
    scopes: card.scopes ?? null,
    tasks: card.tasks ?? null,
    readiness: card.readiness ?? null,
    flashing_material: card.flashingMaterial ?? null,
    materials: card.materials ?? null,
    notes: card.notes ?? null,
    scope_of_work: card.scopeOfWork ?? null,
    field_notes: card.fieldNotes ?? null,
    details: card.details,
  };
}

export async function insertJobcard(card: Jobcard): Promise<void> {
  check((await getSupabase().from('jobcards').insert(jobcardToRow(card))).error);
}
export async function updateJobcard(card: Jobcard): Promise<void> {
  check(
    (
      await getSupabase()
        .from('jobcards')
        .update(jobcardToRow(card))
        .eq('id', card.id)
    ).error
  );
}

function workerToRow(w: Worker) {
  return {
    name: w.name,
    email: w.email,
    phone: w.phone,
    role: w.role,
    trade_role: w.tradeRole,
    installer_type: w.installerType ?? '',
    hourly_rate: w.hourlyRate,
    status: w.status,
  };
}
export async function updateWorker(w: Worker): Promise<void> {
  check(
    (await getSupabase().from('workers').update(workerToRow(w)).eq('id', w.id))
      .error
  );
}

/**
 * Flip the signed-in worker's own row from 'invited' to 'active' (called once
 * after they set their password). Sends only `status` so it can't trip the
 * operator-only role/rate guard trigger; throws on failure so the caller can
 * surface it instead of silently leaving the account stuck as 'invited'.
 */
export async function markSelfActive(id: string): Promise<void> {
  check(
    (await getSupabase().from('workers').update({ status: 'active' }).eq('id', id))
      .error
  );
}

async function replaceMembers(
  table: 'crew_members' | 'daily_crew_members',
  fkColumn: 'crew_id' | 'daily_crew_id',
  parentId: string,
  installerIds: string[]
): Promise<void> {
  const sb = getSupabase();
  check((await sb.from(table).delete().eq(fkColumn, parentId)).error);
  if (installerIds.length) {
    check(
      (
        await sb
          .from(table)
          .insert(installerIds.map((installer_id) => ({ [fkColumn]: parentId, installer_id })))
      ).error
    );
  }
}

export async function insertCrew(crew: Crew): Promise<void> {
  check((await getSupabase().from('crews').insert({ id: crew.id, name: crew.name })).error);
  await replaceMembers('crew_members', 'crew_id', crew.id, crew.installerIds);
}
export async function updateCrew(crew: Crew): Promise<void> {
  check(
    (await getSupabase().from('crews').update({ name: crew.name }).eq('id', crew.id)).error
  );
  await replaceMembers('crew_members', 'crew_id', crew.id, crew.installerIds);
}
export async function deleteCrew(id: string): Promise<void> {
  check((await getSupabase().from('crews').delete().eq('id', id)).error);
}

export async function insertDailyCrew(dc: DailyCrew): Promise<void> {
  check(
    (await getSupabase().from('daily_crews').insert({ id: dc.id, date: dc.date, name: dc.name }))
      .error
  );
  await replaceMembers('daily_crew_members', 'daily_crew_id', dc.id, dc.installerIds);
}
export async function updateDailyCrew(dc: DailyCrew): Promise<void> {
  check(
    (
      await getSupabase()
        .from('daily_crews')
        .update({ date: dc.date, name: dc.name })
        .eq('id', dc.id)
    ).error
  );
  await replaceMembers('daily_crew_members', 'daily_crew_id', dc.id, dc.installerIds);
}
export async function deleteDailyCrew(id: string): Promise<void> {
  check((await getSupabase().from('daily_crews').delete().eq('id', id)).error);
}

export async function insertAssignment(a: ScheduleAssignment): Promise<void> {
  check(
    (
      await getSupabase()
        .from('schedule_assignments')
        .insert({ id: a.id, jobcard_id: a.jobcardId, crew_id: a.crewId, date: a.date })
    ).error
  );
}
export async function deleteAssignment(id: string): Promise<void> {
  check((await getSupabase().from('schedule_assignments').delete().eq('id', id)).error);
}

function timesheetToRow(log: TimesheetLog) {
  return {
    id: log.id,
    worker_id: log.workerId,
    date: log.date,
    jobcard_id: log.jobcardId ?? null,
    custom_project_name: log.customProjectName ?? null,
    start_time: log.startTime,
    end_time: log.endTime,
    total_hours: log.totalHours,
    earned_amount: log.earnedAmount,
    send_status: log.sendStatus,
  };
}
export async function insertTimesheet(log: TimesheetLog): Promise<void> {
  check((await getSupabase().from('timesheets').insert(timesheetToRow(log))).error);
}
export async function updateTimesheet(log: TimesheetLog): Promise<void> {
  check(
    (await getSupabase().from('timesheets').update(timesheetToRow(log)).eq('id', log.id))
      .error
  );
}
export async function deleteTimesheet(id: string): Promise<void> {
  check((await getSupabase().from('timesheets').delete().eq('id', id)).error);
}
export async function markTimesheetsSentRemote(): Promise<void> {
  check(
    (
      await getSupabase()
        .from('timesheets')
        .update({ send_status: 'sent' })
        .in('send_status', ['unsent', 'failed'])
    ).error
  );
}
