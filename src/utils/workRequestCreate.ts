import { format } from 'date-fns';

import { NewWorkRequestInput } from '@/components/desktop/WorkRequestQuickView';
import { uuid } from '@/store/useAppStore';
import { Job } from '@/types';

/**
 * Turn a validated create-draft (from WorkRequestQuickView) into the
 * `addWorkRequest` payload — shared by every surface that creates work
 * requests (the work requests pages and the job details "+ Work Request").
 */
export function newWorkRequestPayload(input: NewWorkRequestInput, jobs: Job[]) {
  const parent = input.jobId
    ? jobs.find((j) => j.id === input.jobId)
    : undefined;
  return {
    jobId: input.jobId,
    jobIds: input.jobIds,
    title: input.title,
    // Standalone requests carry their hand-typed address; linked ones
    // inherit the primary job's location.
    address: input.jobId ? (parent?.location ?? '') : (input.address ?? ''),
    // No calendar date at creation — the Scheduler places it later.
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: input.startTime,
    priority: input.priority,
    priorityStartDate: input.priorityStartDate || undefined,
    priorityEndDate: input.priorityEndDate || undefined,
    scopes: input.scopes,
    // The draft authors task text; each becomes a check-off item with a
    // stable id (installers tick them off from their phones).
    tasks: input.tasks.map((text) => ({ id: uuid(), text, done: false })),
    readiness: input.readiness,
    materials: input.materials,
    flashingMaterial: input.flashingMaterial,
    pickupRequired: input.pickupRequired,
    pickupLocation: input.pickupLocation,
    notes: input.notes,
    details: { generalContractor: '', managerName: '', managerPhone: '' },
  };
}
