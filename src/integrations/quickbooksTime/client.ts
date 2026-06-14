import { QbtConfig, QbtConnection, QbtJobcode } from '@/types';

import { DEFAULT_QBT_BASE_URL } from './config';

/** Error thrown for any failed QuickBooks Time API interaction. */
export class QbtApiError extends Error {
  /** HTTP status, when the failure came from the transport layer. */
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'QbtApiError';
    this.status = status;
  }
}

interface TimesheetInput {
  userId: number;
  jobcodeId: number;
  /** ISO8601 datetime. */
  start: string;
  /** ISO8601 datetime. */
  end: string;
  notes?: string;
}

/** Per-item status block QBT returns inside batch (POST/PUT/DELETE) responses. */
interface BatchItemStatus {
  _status_code: number;
  _status_message?: string;
  _status_extra?: string;
}

function authHeaders(config: QbtConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  };
}

function baseUrl(config: QbtConfig): string {
  return (config.baseUrl || DEFAULT_QBT_BASE_URL).replace(/\/+$/, '');
}

async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new QbtApiError(
      `QuickBooks Time returned a non-JSON response (HTTP ${res.status}).`,
      res.status
    );
  }
}

/** Issue a request and surface auth / transport errors as QbtApiError. */
async function request(
  config: QbtConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<any> {
  if (!config.accessToken) {
    throw new QbtApiError('No QuickBooks Time access token configured.');
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl(config)}${path}`, {
      method,
      headers: authHeaders(config),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new QbtApiError(
      `Could not reach QuickBooks Time: ${
        e instanceof Error ? e.message : 'network error'
      }`
    );
  }

  const json = await parseJson(res);

  if (!res.ok) {
    // OAuth-style error envelope: { error, error_description }.
    const detail =
      json?.error_description ||
      json?.error ||
      json?.message ||
      res.statusText ||
      'request failed';
    if (res.status === 401) {
      throw new QbtApiError(
        'QuickBooks Time rejected the access token (401). Generate a new token and re-enter it.',
        401
      );
    }
    throw new QbtApiError(`QuickBooks Time error: ${detail}`, res.status);
  }

  return json;
}

/** First (and only) entry of a results map keyed by id. */
function firstResult<T>(map: Record<string, T> | undefined): T | undefined {
  if (!map) return undefined;
  const keys = Object.keys(map);
  return keys.length ? map[keys[0]] : undefined;
}

/**
 * Validate the connection and return the account identity plus the payroll
 * approval window (everything on or before `approvedThrough` is locked/approved,
 * everything on or before `submittedThrough` is awaiting approval).
 */
export async function getCurrentUser(config: QbtConfig): Promise<{
  connection: QbtConnection;
  submittedThrough?: string;
  approvedThrough?: string;
}> {
  const json = await request(config, 'GET', '/current_user');
  const user = firstResult<any>(json?.results?.users);
  if (!user || typeof user.id !== 'number') {
    throw new QbtApiError('QuickBooks Time did not return a current user.');
  }
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.username ||
    `User ${user.id}`;
  return {
    connection: {
      userId: user.id,
      name,
      companyName: user.company_name || undefined,
    },
    submittedThrough: datePart(user.submitted_to),
    approvedThrough: datePart(user.approved_to),
  };
}

/** Normalise QBT's "YYYY-MM-DD" / "" date fields to undefined when empty. */
function datePart(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.slice(0, 10);
}

/** Fetch all active jobcodes, following pagination. */
export async function listJobcodes(config: QbtConfig): Promise<QbtJobcode[]> {
  const out: QbtJobcode[] = [];
  let page = 1;
  // QBT caps per_page at 50 for jobcodes; loop until `more` is false.
  for (let guard = 0; guard < 100; guard++) {
    const json = await request(
      config,
      'GET',
      `/jobcodes?active=yes&per_page=50&page=${page}`
    );
    const map = (json?.results?.jobcodes ?? {}) as Record<string, any>;
    for (const jc of Object.values(map)) {
      out.push({
        id: jc.id,
        name: jc.name,
        active: jc.active !== false,
        type: jc.type ?? 'regular',
        parentId: jc.parent_id ?? 0,
      });
    }
    if (!json?.more) break;
    page += 1;
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function assertBatchOk(item: BatchItemStatus | undefined, action: string): void {
  if (!item) {
    throw new QbtApiError(`QuickBooks Time returned no result for ${action}.`);
  }
  // 200 = updated, 201 = created. Anything else is a per-item failure.
  if (item._status_code !== 200 && item._status_code !== 201) {
    const detail =
      item._status_extra || item._status_message || `code ${item._status_code}`;
    throw new QbtApiError(`Could not ${action}: ${detail}`, item._status_code);
  }
}

/** Create a regular (start/end) timesheet. Returns the new QBT timesheet id. */
export async function createTimesheet(
  config: QbtConfig,
  input: TimesheetInput
): Promise<number> {
  const json = await request(config, 'POST', '/timesheets', {
    data: [
      {
        user_id: input.userId,
        jobcode_id: input.jobcodeId,
        type: 'regular',
        start: input.start,
        end: input.end,
        ...(input.notes ? { notes: input.notes } : {}),
      },
    ],
  });
  const item = firstResult<any>(json?.results?.timesheets);
  assertBatchOk(item, 'create the timesheet');
  if (typeof item.id !== 'number') {
    throw new QbtApiError('QuickBooks Time did not return a timesheet id.');
  }
  return item.id;
}

/** Update an existing timesheet's jobcode/start/end. */
export async function updateTimesheet(
  config: QbtConfig,
  timesheetId: number,
  input: TimesheetInput
): Promise<void> {
  const json = await request(config, 'PUT', '/timesheets', {
    data: [
      {
        id: timesheetId,
        jobcode_id: input.jobcodeId,
        start: input.start,
        end: input.end,
        ...(input.notes ? { notes: input.notes } : {}),
      },
    ],
  });
  assertBatchOk(firstResult<any>(json?.results?.timesheets), 'update the timesheet');
}

/** Delete a timesheet by id. Tolerates an already-removed timesheet. */
export async function deleteTimesheet(
  config: QbtConfig,
  timesheetId: number
): Promise<void> {
  const json = await request(
    config,
    'DELETE',
    `/timesheets?ids=${timesheetId}`
  );
  const item = firstResult<BatchItemStatus>(json?.results?.timesheets);
  // 200 = deleted, 404 = already gone — both are fine for our purposes.
  if (item && item._status_code !== 200 && item._status_code !== 404) {
    const detail = item._status_extra || item._status_message || 'unknown error';
    throw new QbtApiError(`Could not delete the timesheet: ${detail}`);
  }
}

export type { TimesheetInput };
