import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { JobPhoto, PendingJobPhoto, PendingPhotoState } from '@/types';

/**
 * One photo as the grid/viewer render it: an uploaded {@link import('@/types').JobPhoto}
 * or a still-uploading pending photo, unified. `pending` is set (with the queue
 * state) only for the latter — the UI shows an upload badge for those.
 */
export interface DisplayPhoto {
  id: string;
  jobId: string;
  workRequestId?: string;
  issueId?: string;
  taskId?: string;
  workerId: string;
  url: string;
  note?: string;
  takenAt: string;
  pending?: PendingPhotoState;
}

function uploadedToDisplay(p: JobPhoto): DisplayPhoto {
  return {
    id: p.id,
    jobId: p.jobId,
    workRequestId: p.workRequestId,
    issueId: p.issueId,
    taskId: p.taskId,
    workerId: p.workerId,
    url: p.url,
    note: p.note,
    takenAt: p.takenAt,
  };
}

function pendingToDisplay(p: PendingJobPhoto): DisplayPhoto {
  return {
    id: p.id,
    jobId: p.jobId,
    workRequestId: p.workRequestId,
    issueId: p.issueId,
    taskId: p.taskId,
    workerId: p.workerId,
    url: p.localUri,
    note: p.note,
    takenAt: p.takenAt,
    pending: p.state,
  };
}

function newestFirst(photos: DisplayPhoto[]): DisplayPhoto[] {
  return photos.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

/**
 * Every photo of a job — uploaded ones plus this device's queued ones — newest
 * first. The two collections never overlap (a photo leaves the queue the moment
 * its row lands). Photos attached to an issue are excluded: they render inside
 * their issue's own gallery, not the general wall.
 */
export function useJobPhotos(jobId: string | undefined): DisplayPhoto[] {
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  return useMemo(() => {
    if (!jobId) return [];
    return newestFirst([
      ...jobPhotos
        .filter((p) => p.jobId === jobId && !p.issueId)
        .map(uploadedToDisplay),
      ...pendingPhotos
        .filter((p) => p.jobId === jobId && !p.issueId)
        .map(pendingToDisplay),
    ]);
  }, [jobId, jobPhotos, pendingPhotos]);
}

/**
 * Every photo linked to one work request (the installer shots taken from its
 * screen), uploaded + this device's queued ones, newest first. Issue photos are
 * excluded here too (they show under their issue on the same screen). Used by
 * the Field Super's work request view and the installer work request's Photos section.
 */
export function useWorkRequestPhotos(workRequestId: string | undefined): DisplayPhoto[] {
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  return useMemo(() => {
    if (!workRequestId) return [];
    return newestFirst([
      ...jobPhotos
        .filter((p) => p.workRequestId === workRequestId && !p.issueId)
        .map(uploadedToDisplay),
      ...pendingPhotos
        .filter((p) => p.workRequestId === workRequestId && !p.issueId)
        .map(pendingToDisplay),
    ]);
  }, [workRequestId, jobPhotos, pendingPhotos]);
}

/**
 * Every photo documenting one issue, uploaded + this device's queued ones,
 * newest first. Rendered inside the issue's card on the work request screen and the
 * parent job page.
 */
export function useIssuePhotos(issueId: string | undefined): DisplayPhoto[] {
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  return useMemo(() => {
    if (!issueId) return [];
    return newestFirst([
      ...jobPhotos.filter((p) => p.issueId === issueId).map(uploadedToDisplay),
      ...pendingPhotos
        .filter((p) => p.issueId === issueId)
        .map(pendingToDisplay),
    ]);
  }, [issueId, jobPhotos, pendingPhotos]);
}
