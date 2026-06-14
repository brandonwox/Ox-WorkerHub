import { AppRole, Worker } from '@/types';

import { rowToWorker } from './auth';
import { getSupabase } from './client';

export interface InviteWorkerInput {
  email: string;
  name: string;
  phone?: string;
  role: AppRole;
  tradeRole?: string;
  hourlyRate?: number;
}

/** Snake_case row returned by the invite-worker function (matches rowToWorker). */
type InvitedWorkerRow = Parameters<typeof rowToWorker>[0];

/**
 * Invite a new worker via the `invite-worker` Edge Function (operator-only: the
 * function verifies the caller is an Operator). Sends the email invite and
 * creates the workers row server-side, returning the new worker.
 */
export async function inviteWorker(input: InviteWorkerInput): Promise<Worker> {
  const { data, error } = await getSupabase().functions.invoke('invite-worker', {
    body: {
      email: input.email,
      name: input.name,
      phone: input.phone ?? '',
      role: input.role,
      tradeRole: input.tradeRole ?? '',
      hourlyRate: input.hourlyRate ?? 0,
    },
  });

  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as { worker?: InvitedWorkerRow; error?: string };
  if (payload.error) throw new Error(payload.error);
  if (!payload.worker) throw new Error('Invite did not return a worker.');
  return rowToWorker(payload.worker);
}
