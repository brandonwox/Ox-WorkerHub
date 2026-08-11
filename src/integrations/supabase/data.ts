import type { RealtimeChannel } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  Crew,
  DailyCrew,
  Job,
  WorkRequest,
  WorkRequestPriority,
  WorkRequestStatus,
  WorkRequestTask,
  JobDocument,
  JobDocumentKind,
  JobDocumentType,
  JobIssue,
  JobIssueStatus,
  JobPhoto,
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
  po: string | null;
  builder: string | null;
  status: string;
  qbt_jobcode_id: string | null;
  flashing_material: string | null;
  flashing_photo_path: string | null;
  scopes: string[] | null;
  cover_photo_id: string | null;
  /** numeric arrives from PostgREST as a string. */
  labor_budget: number | string | null;
  parent_job_id: string | null;
  has_sub_jobs: boolean | null;
  sub_job_type: string | null;
  window_count_done: number | null;
  window_count_total: number | null;
  sgd_count_done: number | null;
  sgd_count_total: number | null;
  mirror_count_done: number | null;
  mirror_count_total: number | null;
  shower_count_done: number | null;
  shower_count_total: number | null;
  swing_door_count_done: number | null;
  swing_door_count_total: number | null;
  screen_count_done: number | null;
  screen_count_total: number | null;
  igu_count_done: number | null;
  igu_count_total: number | null;
  window_layout_not_needed: boolean | null;
  mirror_layout_not_needed: boolean | null;
  shower_layout_not_needed: boolean | null;
}

interface JobFieldSuperRow {
  job_id: string;
  field_super_id: string;
}

interface WorkRequestRow {
  id: string;
  job_id: string | null;
  /** All linked job ids (multi-sub-job cards); null/short means job_id alone. */
  job_ids: string[] | null;
  title: string;
  address: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: string;
  priority_order: number;
  priority_start_date: string | null;
  priority_end_date: string | null;
  scopes: string[] | null;
  /** jsonb array of WorkRequestTask objects (plain strings only pre-migration). */
  tasks: (WorkRequestTask | string)[] | null;
  readiness: string | null;
  flashing_material: string | null;
  materials: string | null;
  notes: string | null;
  scope_of_work: string | null;
  field_notes: string | null;
  pickup_required: boolean | null;
  pickup_location: string | null;
  status_note: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  undefined_reminder_date: string | null;
  details: {
    generalContractor?: string;
    managerName?: string;
    managerPhone?: string;
  } | null;
  created_at: string;
}

interface CrewRow {
  id: string;
  name: string;
  color: string | null;
}
interface CrewMemberRow {
  crew_id: string;
  installer_id: string;
  /** Exactly one member per permanent crew carries the foreman tag. */
  is_foreman: boolean | null;
}
interface DailyCrewRow {
  id: string;
  date: string;
  name: string;
  color: string | null;
}
interface DailyCrewMemberRow {
  daily_crew_id: string;
  installer_id: string;
}

interface AssignmentRow {
  id: string;
  work_request_id: string;
  crew_id: string;
  date: string;
}

interface TimesheetRow {
  id: string;
  worker_id: string;
  date: string;
  work_request_id: string | null;
  custom_project_name: string | null;
  start_time: string;
  end_time: string;
  total_hours: number;
  earned_amount: number;
  send_status: string;
}

interface JobPhotoRow {
  id: string;
  job_id: string;
  work_request_id: string | null;
  issue_id: string | null;
  task_id: string | null;
  worker_id: string;
  storage_path: string;
  note: string | null;
  taken_at: string;
  is_video: boolean | null;
  sgd_video: boolean | null;
}

interface JobIssueRow {
  id: string;
  job_id: string;
  work_request_id: string | null;
  task_id: string | null;
  worker_id: string;
  description: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface JobDocumentRow {
  id: string;
  job_id: string;
  worker_id: string;
  kind: string;
  doc_type: string | null;
  title: string;
  body: string | null;
  storage_path: string | null;
  created_at: string;
}

// --- Mappers (row -> domain) -------------------------------------------------

/**
 * Map legacy scope values onto the current set (rows read before the scopes
 * migration ran still carry 'Showerglass Door' — renamed to 'Showers').
 */
function normalizeScopes(scopes: string[] | null): JobScope[] | undefined {
  if (!scopes) return undefined;
  return scopes.map((s) =>
    s === 'Showerglass Door' ? 'Showers' : s
  ) as JobScope[];
}

function rowToJob(r: JobRow): Job {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    po: r.po ?? undefined,
    builder: r.builder ?? undefined,
    // Legacy rows read before the rename migration ran still say 'Archived'.
    status: (r.status === 'Archived' ? 'Finished' : r.status) as JobStatus,
    qbtJobcodeId: r.qbt_jobcode_id ?? undefined,
    flashingMaterial: r.flashing_material ?? undefined,
    flashingPhotoPath: r.flashing_photo_path ?? undefined,
    flashingPhotoUrl: r.flashing_photo_path
      ? jobPhotoUrl(r.flashing_photo_path)
      : undefined,
    scopes: normalizeScopes(r.scopes),
    coverPhotoId: r.cover_photo_id ?? undefined,
    laborBudget: r.labor_budget != null ? Number(r.labor_budget) : undefined,
    parentJobId: r.parent_job_id ?? undefined,
    hasSubJobs: r.has_sub_jobs ?? undefined,
    subJobType: r.sub_job_type ?? undefined,
    windowCountDone: r.window_count_done ?? undefined,
    windowCountTotal: r.window_count_total ?? undefined,
    sgdCountDone: r.sgd_count_done ?? undefined,
    sgdCountTotal: r.sgd_count_total ?? undefined,
    mirrorCountDone: r.mirror_count_done ?? undefined,
    mirrorCountTotal: r.mirror_count_total ?? undefined,
    showerCountDone: r.shower_count_done ?? undefined,
    showerCountTotal: r.shower_count_total ?? undefined,
    swingDoorCountDone: r.swing_door_count_done ?? undefined,
    swingDoorCountTotal: r.swing_door_count_total ?? undefined,
    screenCountDone: r.screen_count_done ?? undefined,
    screenCountTotal: r.screen_count_total ?? undefined,
    iguCountDone: r.igu_count_done ?? undefined,
    iguCountTotal: r.igu_count_total ?? undefined,
    windowLayoutNotNeeded: r.window_layout_not_needed || undefined,
    mirrorLayoutNotNeeded: r.mirror_layout_not_needed || undefined,
    showerLayoutNotNeeded: r.shower_layout_not_needed || undefined,
  };
}

/**
 * Tolerate rows read before the tasks-to-jsonb migration ran: plain string
 * tasks get a synthetic id so the UI renders (check-offs on them are refused
 * server-side until the migration lands).
 */
function normalizeTasks(
  raw: (WorkRequestTask | string)[] | null
): WorkRequestTask[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  return raw.map((t, i) =>
    typeof t === 'string' ? { id: `legacy-${i}`, text: t, done: false } : t
  );
}

/**
 * Map pre-rename readiness values onto the Yes/No/Soon presets (rows read
 * before the work-requests migration ran still carry the old labels).
 */
function normalizeReadiness(readiness: string | null): string | undefined {
  if (readiness == null) return undefined;
  if (readiness === 'Now') return 'Yes';
  if (readiness === 'Over 2 Weeks') return 'No';
  return readiness;
}

/**
 * Map pre-rename statuses onto the new set (rows read before the
 * work-requests migration ran): the retired 'No Progress' — and an
 * 'Untouched' that was only ever the old default (it has no typed reason) —
 * both read as 'Undefined'.
 */
function normalizeStatus(status: string, note: string | null): WorkRequestStatus {
  if (status === 'No Progress') return 'Undefined';
  if (status === 'Untouched' && !note) return 'Undefined';
  return status as WorkRequestStatus;
}

function rowToWorkRequest(r: WorkRequestRow): WorkRequest {
  return {
    id: r.id,
    jobId: r.job_id ?? undefined,
    jobIds: r.job_ids && r.job_ids.length > 1 ? r.job_ids : undefined,
    title: r.title,
    address: r.address,
    date: r.date,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    status: normalizeStatus(r.status, r.status_note),
    statusNote: r.status_note ?? undefined,
    statusChangedAt: r.status_changed_at ?? undefined,
    statusChangedById: r.status_changed_by ?? undefined,
    undefinedReminderDate: r.undefined_reminder_date ?? undefined,
    priority: r.priority as WorkRequestPriority,
    priorityOrder: r.priority_order,
    priorityStartDate: r.priority_start_date ?? undefined,
    priorityEndDate: r.priority_end_date ?? undefined,
    scopes: normalizeScopes(r.scopes),
    tasks: normalizeTasks(r.tasks),
    readiness: normalizeReadiness(r.readiness),
    flashingMaterial: r.flashing_material ?? undefined,
    materials: r.materials ?? undefined,
    notes: r.notes ?? undefined,
    scopeOfWork: r.scope_of_work ?? undefined,
    fieldNotes: r.field_notes ?? undefined,
    pickupRequired: r.pickup_required ?? undefined,
    pickupLocation: r.pickup_location ?? undefined,
    details: {
      generalContractor: r.details?.generalContractor ?? '',
      managerName: r.details?.managerName ?? '',
      managerPhone: r.details?.managerPhone ?? '',
    },
    createdAt: r.created_at ?? undefined,
  };
}

function rowToAssignment(r: AssignmentRow): ScheduleAssignment {
  return { id: r.id, workRequestId: r.work_request_id, crewId: r.crew_id, date: r.date };
}

function rowToTimesheet(r: TimesheetRow): TimesheetLog {
  return {
    id: r.id,
    workerId: r.worker_id,
    date: r.date,
    workRequestId: r.work_request_id ?? undefined,
    customProjectName: r.custom_project_name ?? undefined,
    startTime: r.start_time,
    endTime: r.end_time,
    totalHours: Number(r.total_hours),
    earnedAmount: Number(r.earned_amount),
    sendStatus: r.send_status as TimesheetSendStatus,
  };
}

/** The storage bucket job photos live in (public reads; see its migration). */
const PHOTO_BUCKET = 'job-photos';

/** Public render URL for a photo's storage object. */
export function jobPhotoUrl(storagePath: string): string {
  return getSupabase().storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

function rowToJobPhoto(r: JobPhotoRow): JobPhoto {
  return {
    id: r.id,
    jobId: r.job_id,
    workRequestId: r.work_request_id ?? undefined,
    issueId: r.issue_id ?? undefined,
    taskId: r.task_id ?? undefined,
    workerId: r.worker_id,
    storagePath: r.storage_path,
    url: jobPhotoUrl(r.storage_path),
    note: r.note ?? undefined,
    takenAt: r.taken_at,
    isVideo: r.is_video || undefined,
    sgdVideo: r.sgd_video || undefined,
  };
}

/** The storage bucket job documents (photos/PDFs) live in (public reads). */
const DOCUMENT_BUCKET = 'job-documents';

/** Public render/open URL for a document's storage object. */
export function jobDocumentUrl(storagePath: string): string {
  return getSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;
}

function rowToJobDocument(r: JobDocumentRow): JobDocument {
  return {
    id: r.id,
    jobId: r.job_id,
    workerId: r.worker_id,
    kind: r.kind as JobDocumentKind,
    docType: (r.doc_type as JobDocumentType | null) ?? undefined,
    title: r.title,
    body: r.body ?? undefined,
    storagePath: r.storage_path ?? undefined,
    url: r.storage_path ? jobDocumentUrl(r.storage_path) : undefined,
    createdAt: r.created_at,
  };
}

function rowToJobIssue(r: JobIssueRow): JobIssue {
  return {
    id: r.id,
    jobId: r.job_id,
    workRequestId: r.work_request_id ?? undefined,
    taskId: r.task_id ?? undefined,
    workerId: r.worker_id,
    description: r.description,
    status: r.status as JobIssueStatus,
    resolvedById: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    createdAt: r.created_at,
  };
}

// --- Bulk read ---------------------------------------------------------------

export interface BackendData {
  workers: Worker[];
  jobs: Job[];
  workRequests: WorkRequest[];
  crews: Crew[];
  dailyCrews: DailyCrew[];
  assignments: ScheduleAssignment[];
  logs: TimesheetLog[];
  jobPhotos: JobPhoto[];
  jobIssues: JobIssue[];
  jobDocuments: JobDocument[];
}

/** Load every collection from Supabase (RLS-scoped to the caller). */
export async function fetchAllData(): Promise<BackendData> {
  const sb = getSupabase();

  const [
    workersR,
    jobsR,
    jobFieldSupersR,
    workRequestsR,
    crewsR,
    crewMembersR,
    dailyCrewsR,
    dailyCrewMembersR,
    assignmentsR,
    timesheetsR,
    jobPhotosR,
    jobIssuesR,
    jobDocumentsR,
  ] = await Promise.all([
    sb.from('workers').select('*'),
    sb.from('jobs').select('*'),
    // Ordered oldest-first: a job's displayed Field Super is the FIRST one
    // assigned (fieldSuperIds[0]), so assignment order must survive the trip.
    sb.from('job_field_supers').select('*').order('assigned_at'),
    sb.from('work_requests').select('*'),
    sb.from('crews').select('*'),
    sb.from('crew_members').select('*'),
    sb.from('daily_crews').select('*'),
    sb.from('daily_crew_members').select('*'),
    sb.from('schedule_assignments').select('*'),
    sb.from('timesheets').select('*'),
    sb.from('job_photos').select('*'),
    sb.from('job_issues').select('*'),
    sb.from('job_documents').select('*'),
  ]);

  const firstError =
    workersR.error ??
    jobsR.error ??
    jobFieldSupersR.error ??
    workRequestsR.error ??
    crewsR.error ??
    crewMembersR.error ??
    dailyCrewsR.error ??
    dailyCrewMembersR.error ??
    assignmentsR.error ??
    timesheetsR.error;
  if (firstError) throw new Error(firstError.message);
  // Photos are non-fatal: a project that hasn't run the job_photos migration
  // yet still hydrates everything else (mirrors how notifications degrade).
  if (jobPhotosR.error) {
    console.warn('Job photos load failed; none shown.', jobPhotosR.error.message);
  }
  // Issues degrade the same way while their migration hasn't run yet.
  if (jobIssuesR.error) {
    console.warn('Job issues load failed; none shown.', jobIssuesR.error.message);
  }
  // Documents degrade the same way while their migration hasn't run yet.
  if (jobDocumentsR.error) {
    console.warn(
      'Job documents load failed; none shown.',
      jobDocumentsR.error.message
    );
  }
  // Group Field Super assignments by job so each Job carries its own
  // fieldSuperIds list.
  const jobFieldSupers = (jobFieldSupersR.data ?? []) as JobFieldSuperRow[];
  const fieldSuperIdsByJob = new Map<string, string[]>();
  for (const { job_id, field_super_id } of jobFieldSupers) {
    const list = fieldSuperIdsByJob.get(job_id);
    if (list) list.push(field_super_id);
    else fieldSuperIdsByJob.set(job_id, [field_super_id]);
  }

  const crewMembers = (crewMembersR.data ?? []) as CrewMemberRow[];
  const crews: Crew[] = ((crewsR.data ?? []) as CrewRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color ?? undefined,
    installerIds: crewMembers
      .filter((m) => m.crew_id === c.id)
      .map((m) => m.installer_id),
    foremanId: crewMembers.find((m) => m.crew_id === c.id && m.is_foreman)
      ?.installer_id,
  }));

  const dailyMembers = (dailyCrewMembersR.data ?? []) as DailyCrewMemberRow[];
  const dailyCrews: DailyCrew[] = (
    (dailyCrewsR.data ?? []) as DailyCrewRow[]
  ).map((c) => ({
    id: c.id,
    date: c.date,
    name: c.name,
    color: c.color ?? undefined,
    installerIds: dailyMembers
      .filter((m) => m.daily_crew_id === c.id)
      .map((m) => m.installer_id),
  }));

  return {
    workers: ((workersR.data ?? []) as Parameters<typeof rowToWorker>[0][]).map(
      rowToWorker
    ),
    jobs: ((jobsR.data ?? []) as JobRow[]).map((r) => ({
      ...rowToJob(r),
      fieldSuperIds: fieldSuperIdsByJob.get(r.id) ?? [],
    })),
    workRequests: ((workRequestsR.data ?? []) as WorkRequestRow[]).map(rowToWorkRequest),
    crews,
    dailyCrews,
    assignments: ((assignmentsR.data ?? []) as AssignmentRow[]).map(
      rowToAssignment
    ),
    logs: ((timesheetsR.data ?? []) as TimesheetRow[]).map(rowToTimesheet),
    jobPhotos: ((jobPhotosR.data ?? []) as JobPhotoRow[]).map(rowToJobPhoto),
    jobIssues: ((jobIssuesR.data ?? []) as JobIssueRow[]).map(rowToJobIssue),
    jobDocuments: ((jobDocumentsR.data ?? []) as JobDocumentRow[]).map(
      rowToJobDocument
    ),
  };
}

// --- Write layer (domain -> row). INSERT and UPDATE are kept separate so an
//     update never trips a stricter INSERT RLS policy (e.g. self profile edits).

/**
 * An error thrown by the write layer, carrying Postgres' SQLSTATE. The outbox
 * flusher reads `code` to tell a permission refusal ('42501' — RLS or one of
 * the role guards) apart from a bug or a transport failure.
 */
export class BackendWriteError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'BackendWriteError';
    this.code = code;
  }
}

function check(error: { message: string; code?: string } | null): void {
  if (error) throw new BackendWriteError(error.message, error.code);
}

function jobToRow(job: Job) {
  return {
    id: job.id,
    name: job.name,
    location: job.location,
    po: job.po ?? null,
    builder: job.builder ?? null,
    status: job.status,
    qbt_jobcode_id: job.qbtJobcodeId ?? null,
    flashing_material: job.flashingMaterial ?? null,
    flashing_photo_path: job.flashingPhotoPath ?? null,
    scopes: job.scopes ?? null,
    cover_photo_id: job.coverPhotoId ?? null,
    labor_budget: job.laborBudget ?? null,
    parent_job_id: job.parentJobId ?? null,
    has_sub_jobs: job.hasSubJobs ?? false,
    sub_job_type: job.subJobType ?? null,
    window_count_done: job.windowCountDone ?? null,
    window_count_total: job.windowCountTotal ?? null,
    sgd_count_done: job.sgdCountDone ?? null,
    sgd_count_total: job.sgdCountTotal ?? null,
    mirror_count_done: job.mirrorCountDone ?? null,
    mirror_count_total: job.mirrorCountTotal ?? null,
    shower_count_done: job.showerCountDone ?? null,
    shower_count_total: job.showerCountTotal ?? null,
    swing_door_count_done: job.swingDoorCountDone ?? null,
    swing_door_count_total: job.swingDoorCountTotal ?? null,
    screen_count_done: job.screenCountDone ?? null,
    screen_count_total: job.screenCountTotal ?? null,
    igu_count_done: job.iguCountDone ?? null,
    igu_count_total: job.iguCountTotal ?? null,
    window_layout_not_needed: job.windowLayoutNotNeeded ?? false,
    mirror_layout_not_needed: job.mirrorLayoutNotNeeded ?? false,
    shower_layout_not_needed: job.showerLayoutNotNeeded ?? false,
  };
}

export async function insertJob(job: Job): Promise<void> {
  check((await getSupabase().from('jobs').insert(jobToRow(job))).error);
  // Sub-jobs inherit the parent's Field Supers via a DB trigger (the creator —
  // a scheduler or field super — has no write grant on job_field_supers).
  if (job.parentJobId) return;
  // Field Super assignments live in the job_field_supers join table, not on
  // the jobs row. Only written when there are assignments to record (the
  // Operator's and Scheduler's create flows — both may write the table). A
  // creating Field Super passes none; a DB trigger auto-assigns them instead.
  const supers = job.fieldSuperIds ?? [];
  if (supers.length > 0) await setJobFieldSupers(job.id, supers);
}
export async function updateJob(job: Job): Promise<void> {
  // Note: Field Super assignments are NOT written here. They go through
  // setJobFieldSupers so a non-operator update (e.g. a Field Super editing
  // flashing material) never touches the operator-only job_field_supers table.
  // See useAppStore.updateJob.
  check(
    (await getSupabase().from('jobs').update(jobToRow(job)).eq('id', job.id))
      .error
  );
}
export async function deleteJob(id: string): Promise<void> {
  check((await getSupabase().from('jobs').delete().eq('id', id)).error);
}

/**
 * Set a job's Field Super assignments (operator + scheduler). Diffed — only
 * missing rows are inserted and dropped ones deleted — so a surviving
 * assignment keeps its original assigned_at (the "first assigned" super stays
 * first no matter how often the list is edited around them).
 */
export async function setJobFieldSupers(
  jobId: string,
  fieldSuperIds: string[]
): Promise<void> {
  const sb = getSupabase();
  const current = await sb
    .from('job_field_supers')
    .select('field_super_id')
    .eq('job_id', jobId);
  check(current.error);
  const existing = new Set(
    ((current.data ?? []) as { field_super_id: string }[]).map(
      (r) => r.field_super_id
    )
  );
  const wanted = new Set(fieldSuperIds);
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = fieldSuperIds.filter((id) => !existing.has(id));
  if (toRemove.length) {
    check(
      (
        await sb
          .from('job_field_supers')
          .delete()
          .eq('job_id', jobId)
          .in('field_super_id', toRemove)
      ).error
    );
  }
  if (toAdd.length) {
    check(
      (
        await sb
          .from('job_field_supers')
          .insert(
            toAdd.map((field_super_id) => ({ job_id: jobId, field_super_id }))
          )
      ).error
    );
  }
}

/**
 * Additively assign ONE Field Super to a job — the self-assign path (a field
 * super may only write their own row; RLS enforces it). Already-assigned is a
 * no-op instead of an error so an offline-queued tap can't fail on replay.
 */
export async function assignJobFieldSuper(
  jobId: string,
  fieldSuperId: string
): Promise<void> {
  check(
    (
      await getSupabase()
        .from('job_field_supers')
        .upsert(
          { job_id: jobId, field_super_id: fieldSuperId },
          { onConflict: 'job_id,field_super_id', ignoreDuplicates: true }
        )
    ).error
  );
}

function workRequestToRow(card: WorkRequest) {
  return {
    id: card.id,
    job_id: card.jobId ?? null,
    job_ids: card.jobIds ?? null,
    title: card.title,
    address: card.address,
    date: card.date,
    start_time: card.startTime ?? null,
    end_time: card.endTime ?? null,
    status: card.status,
    status_note: card.statusNote ?? null,
    status_changed_at: card.statusChangedAt ?? null,
    status_changed_by: card.statusChangedById ?? null,
    undefined_reminder_date: card.undefinedReminderDate ?? null,
    priority: card.priority,
    priority_order: card.priorityOrder,
    priority_start_date: card.priorityStartDate ?? null,
    priority_end_date: card.priorityEndDate ?? null,
    scopes: card.scopes ?? null,
    // Column is NOT NULL — an absent task list writes as the empty jsonb array.
    tasks: card.tasks ?? [],
    readiness: card.readiness ?? null,
    flashing_material: card.flashingMaterial ?? null,
    materials: card.materials ?? null,
    notes: card.notes ?? null,
    scope_of_work: card.scopeOfWork ?? null,
    field_notes: card.fieldNotes ?? null,
    pickup_required: card.pickupRequired ?? null,
    pickup_location: card.pickupLocation ?? null,
    details: card.details,
  };
}

export async function insertWorkRequest(card: WorkRequest): Promise<void> {
  check((await getSupabase().from('work_requests').insert(workRequestToRow(card))).error);
}
export async function updateWorkRequest(card: WorkRequest): Promise<void> {
  check(
    (
      await getSupabase()
        .from('work_requests')
        .update(workRequestToRow(card))
        .eq('id', card.id)
    ).error
  );
}
export async function deleteWorkRequest(id: string): Promise<void> {
  check((await getSupabase().from('work_requests').delete().eq('id', id)).error);
}

/**
 * Profile columns only. `role` and `hourly_rate` are operator-only (enforced by
 * the `guard_worker_role_rate` DB trigger), so they are NEVER sent on a general
 * profile update — a self-edit (name/phone/email) would otherwise be rejected
 * for sending a role/rate the trigger thinks changed. Role/rate go through
 * updateWorkerRole / updateWorkerRate, called only from operator actions. Mirrors
 * markSelfActive, which sends just `status` for exactly this reason.
 */
function workerProfileRow(w: Worker) {
  return {
    name: w.name,
    email: w.email,
    phone: w.phone,
    trade_role: w.tradeRole,
    installer_type: w.installerType ?? '',
    status: w.status,
  };
}
export async function updateWorker(w: Worker): Promise<void> {
  check(
    (
      await getSupabase()
        .from('workers')
        .update(workerProfileRow(w))
        .eq('id', w.id)
    ).error
  );
}
/** Operator-only: change a worker's role (sent alone to satisfy the DB guard). */
export async function updateWorkerRole(id: string, role: Worker['role']): Promise<void> {
  check((await getSupabase().from('workers').update({ role }).eq('id', id)).error);
}
/** Operator-only: change a worker's pay rate (sent alone to satisfy the DB guard). */
export async function updateWorkerRate(id: string, hourlyRate: number): Promise<void> {
  check(
    (await getSupabase().from('workers').update({ hourly_rate: hourlyRate }).eq('id', id))
      .error
  );
}
export async function deleteWorker(id: string): Promise<void> {
  check((await getSupabase().from('workers').delete().eq('id', id)).error);
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
  installerIds: string[],
  /** Permanent crews only: the member row that carries the foreman tag. */
  foremanId?: string
): Promise<void> {
  const sb = getSupabase();
  check((await sb.from(table).delete().eq(fkColumn, parentId)).error);
  if (installerIds.length) {
    check(
      (
        await sb.from(table).insert(
          installerIds.map((installer_id) => ({
            [fkColumn]: parentId,
            installer_id,
            // Daily crews have no foreman (nor the column).
            ...(table === 'crew_members'
              ? { is_foreman: installer_id === foremanId }
              : {}),
          }))
        )
      ).error
    );
  }
}

export async function insertCrew(crew: Crew): Promise<void> {
  check(
    (
      await getSupabase()
        .from('crews')
        .insert({ id: crew.id, name: crew.name, color: crew.color ?? null })
    ).error
  );
  await replaceMembers(
    'crew_members',
    'crew_id',
    crew.id,
    crew.installerIds,
    crew.foremanId
  );
}
export async function updateCrew(crew: Crew): Promise<void> {
  check(
    (
      await getSupabase()
        .from('crews')
        .update({ name: crew.name, color: crew.color ?? null })
        .eq('id', crew.id)
    ).error
  );
  await replaceMembers(
    'crew_members',
    'crew_id',
    crew.id,
    crew.installerIds,
    crew.foremanId
  );
}
export async function deleteCrew(id: string): Promise<void> {
  check((await getSupabase().from('crews').delete().eq('id', id)).error);
}

export async function insertDailyCrew(dc: DailyCrew): Promise<void> {
  check(
    (
      await getSupabase()
        .from('daily_crews')
        .insert({ id: dc.id, date: dc.date, name: dc.name, color: dc.color ?? null })
    ).error
  );
  await replaceMembers('daily_crew_members', 'daily_crew_id', dc.id, dc.installerIds);
}
export async function updateDailyCrew(dc: DailyCrew): Promise<void> {
  check(
    (
      await getSupabase()
        .from('daily_crews')
        .update({ date: dc.date, name: dc.name, color: dc.color ?? null })
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
        .insert({ id: a.id, work_request_id: a.workRequestId, crew_id: a.crewId, date: a.date })
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
    work_request_id: log.workRequestId ?? null,
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

// --- Job photos ----------------------------------------------------------------

/**
 * Decode a base64 string to bytes. Storage uploads from React Native must send
 * raw bytes (there is no Blob for a file:// uri); Hermes ships atob, so no
 * extra dependency is needed.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Push a photo's bytes to the job-photos bucket. On native the local file is
 * read as base64 and sent as raw bytes; on web the picker's blob uri is fetched
 * directly. Upsert so a retry after a half-failed attempt can't collide.
 */
export async function uploadJobPhoto(
  localUri: string,
  storagePath: string,
  contentType = 'image/jpeg'
): Promise<void> {
  // Storage must see the signed-in worker: with no session supabase-js silently
  // falls back to the anon key and the server rejects the object with a bare
  // "new row violates row-level security policy". Check up front (recovering
  // via an explicit refresh when possible) so the queue logs the real problem.
  const auth = getSupabase().auth;
  let session = (await auth.getSession()).data.session;
  if (!session) session = (await auth.refreshSession()).data.session;
  if (!session) {
    throw new Error(
      'No auth session — photo upload would run as anon. Sign out and back in.'
    );
  }
  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await (await fetch(localUri)).blob();
  } else {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    body = base64ToBytes(base64).buffer as ArrayBuffer;
  }
  const { error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .upload(storagePath, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

export async function insertJobPhoto(photo: JobPhoto): Promise<void> {
  check(
    (
      await getSupabase().from('job_photos').insert({
        id: photo.id,
        job_id: photo.jobId,
        work_request_id: photo.workRequestId ?? null,
        issue_id: photo.issueId ?? null,
        task_id: photo.taskId ?? null,
        worker_id: photo.workerId,
        storage_path: photo.storagePath,
        note: photo.note ?? null,
        taken_at: photo.takenAt,
        is_video: photo.isVideo ?? false,
        sgd_video: photo.sgdVideo ?? false,
      })
    ).error
  );
}

/** Tag/untag an uploaded video as an SGD video (owner-only per RLS). */
export async function updateJobPhotoSgd(
  id: string,
  sgdVideo: boolean
): Promise<void> {
  check(
    (
      await getSupabase()
        .from('job_photos')
        .update({ sgd_video: sgdVideo })
        .eq('id', id)
    ).error
  );
}

// --- Job documents -------------------------------------------------------------

/**
 * Push a document's file bytes (image or PDF) to the job-documents bucket.
 * Same transport as {@link uploadJobPhoto}: raw bytes on native, blob on web.
 */
export async function uploadJobDocumentFile(
  localUri: string,
  storagePath: string,
  contentType: string
): Promise<void> {
  const auth = getSupabase().auth;
  let session = (await auth.getSession()).data.session;
  if (!session) session = (await auth.refreshSession()).data.session;
  if (!session) {
    throw new Error(
      'No auth session — document upload would run as anon. Sign out and back in.'
    );
  }
  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await (await fetch(localUri)).blob();
  } else {
    // "Choose from Job images" passes the photo's public https URL — native
    // FileSystem only reads file uris, so pull it into the cache first.
    let fileUri = localUri;
    if (/^https?:/.test(localUri)) {
      const target = `${FileSystem.cacheDirectory}doc-src-${Date.now()}.tmp`;
      fileUri = (await FileSystem.downloadAsync(localUri, target)).uri;
    }
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    body = base64ToBytes(base64).buffer as ArrayBuffer;
  }
  const { error } = await getSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .upload(storagePath, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

export async function insertJobDocument(doc: JobDocument): Promise<void> {
  check(
    (
      await getSupabase().from('job_documents').insert({
        id: doc.id,
        job_id: doc.jobId,
        worker_id: doc.workerId,
        kind: doc.kind,
        doc_type: doc.docType ?? null,
        title: doc.title,
        body: doc.body ?? null,
        storage_path: doc.storagePath ?? null,
        created_at: doc.createdAt,
      })
    ).error
  );
}

/**
 * Retag an existing document ("Choose from Job documents" assigns a layout
 * plan to a document that already exists). RLS: the creator, the Operator, or
 * a Field Super scoped to the document's job.
 */
export async function updateJobDocumentType(
  id: string,
  docType: JobDocumentType | undefined
): Promise<void> {
  check(
    (
      await getSupabase()
        .from('job_documents')
        .update({ doc_type: docType ?? null })
        .eq('id', id)
    ).error
  );
}

/**
 * Edit a document's user-authored fields: title, body (text kind), and the
 * type tag. RLS: the creator, the Operator, or a Field Super scoped to the
 * document's job.
 */
export async function updateJobDocument(doc: {
  id: string;
  title: string;
  body?: string;
  docType?: JobDocumentType;
}): Promise<void> {
  check(
    (
      await getSupabase()
        .from('job_documents')
        .update({
          title: doc.title,
          body: doc.body ?? null,
          doc_type: doc.docType ?? null,
        })
        .eq('id', doc.id)
    ).error
  );
}

/**
 * Delete a document: the row first, then its storage object (photo/pdf). A
 * failed object removal leaves a harmless orphan file.
 */
export async function deleteJobDocument(
  id: string,
  storagePath: string | undefined
): Promise<void> {
  check((await getSupabase().from('job_documents').delete().eq('id', id)).error);
  if (!storagePath) return;
  const { error } = await getSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .remove([storagePath]);
  if (error) {
    console.warn('Job document storage object not removed:', error.message);
  }
}

// --- Job issues ----------------------------------------------------------------

function jobIssueToRow(issue: JobIssue) {
  return {
    id: issue.id,
    job_id: issue.jobId,
    work_request_id: issue.workRequestId ?? null,
    task_id: issue.taskId ?? null,
    worker_id: issue.workerId,
    description: issue.description,
    status: issue.status,
    resolved_by: issue.resolvedById ?? null,
    resolved_at: issue.resolvedAt ?? null,
    created_at: issue.createdAt,
  };
}

export async function insertJobIssue(issue: JobIssue): Promise<void> {
  check((await getSupabase().from('job_issues').insert(jobIssueToRow(issue))).error);
}

export async function updateJobIssue(issue: JobIssue): Promise<void> {
  check(
    (
      await getSupabase()
        .from('job_issues')
        .update(jobIssueToRow(issue))
        .eq('id', issue.id)
    ).error
  );
}

export async function deleteJobIssue(id: string): Promise<void> {
  check((await getSupabase().from('job_issues').delete().eq('id', id)).error);
}

export async function updateJobPhotoNote(
  id: string,
  note: string | undefined
): Promise<void> {
  check(
    (
      await getSupabase()
        .from('job_photos')
        .update({ note: note ?? null })
        .eq('id', id)
    ).error
  );
}

/**
 * Best-effort removal of a storage object in the job-photos bucket (used when a
 * job's flashing photo is replaced). A failure just leaves an orphan file —
 * harmless, nothing references it anymore.
 */
export async function removePhotoObject(storagePath: string): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .remove([storagePath]);
  if (error) {
    console.warn('Photo storage object not removed:', error.message);
  }
}

/**
 * Delete a photo: the metadata row first (the authoritative record), then the
 * storage object. A failed object removal leaves an orphan file, which is
 * harmless — nothing references it once the row is gone.
 */
export async function deleteJobPhoto(
  id: string,
  storagePath: string
): Promise<void> {
  check((await getSupabase().from('job_photos').delete().eq('id', id)).error);
  const { error } = await getSupabase()
    .storage.from(PHOTO_BUCKET)
    .remove([storagePath]);
  if (error) {
    console.warn('Job photo storage object not removed:', error.message);
  }
}

// --- Realtime sync -----------------------------------------------------------

/**
 * The collaborative tables whose changes any session needs to see live. When a
 * Field Super creates a work request or the Operator adds a worker, every other signed-in
 * session should reflect it without a manual refresh. (Notifications have their
 * own recipient-scoped channel in ./notifications and are intentionally omitted
 * here.) These tables must also be members of the `supabase_realtime`
 * publication — see the realtime-core-tables migration.
 */
const REALTIME_TABLES = [
  'workers',
  'jobs',
  'job_field_supers',
  'work_requests',
  'crews',
  'crew_members',
  'daily_crews',
  'daily_crew_members',
  'schedule_assignments',
  'timesheets',
  'job_photos',
  'job_issues',
  'job_documents',
] as const;

// One shared data channel per session; re-subscribing (or signing out) tears the
// previous one down so channels never leak across sessions.
let dataChannel: RealtimeChannel | null = null;

/**
 * Stream INSERT/UPDATE/DELETE on every collaborative table and invoke `onChange`
 * for each one. Realtime evaluates each table's SELECT RLS policy, so a session
 * only ever receives rows it is allowed to read. `onChange` fires once per row
 * event; callers should debounce a refetch since one logical change can emit
 * several events (e.g. a job plus its job_field_supers rows). Idempotent: replaces any
 * prior subscription.
 */
export function subscribeAllData(onChange: () => void): void {
  unsubscribeAllData();
  let ch = getSupabase().channel('app-data');
  for (const table of REALTIME_TABLES) {
    ch = ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => onChange()
    );
  }
  dataChannel = ch.subscribe();
}

/** Tear down the active data channel (on sign-out / re-subscribe). */
export function unsubscribeAllData(): void {
  if (dataChannel) {
    getSupabase().removeChannel(dataChannel);
    dataChannel = null;
  }
}
