import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { PendingPhotoState } from '@/types';

/**
 * One photo as the grid/viewer render it: an uploaded {@link import('@/types').JobPhoto}
 * or a still-uploading pending photo, unified. `pending` is set (with the queue
 * state) only for the latter — the UI shows an upload badge for those.
 */
export interface DisplayPhoto {
  id: string;
  jobId: string;
  jobcardId?: string;
  workerId: string;
  url: string;
  note?: string;
  takenAt: string;
  pending?: PendingPhotoState;
}

/**
 * Every photo of a job — uploaded ones plus this device's queued ones — newest
 * first. The two collections never overlap (a photo leaves the queue the moment
 * its row lands).
 */
export function useJobPhotos(jobId: string | undefined): DisplayPhoto[] {
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  return useMemo(() => {
    if (!jobId) return [];
    const uploaded: DisplayPhoto[] = jobPhotos
      .filter((p) => p.jobId === jobId)
      .map((p) => ({
        id: p.id,
        jobId: p.jobId,
        jobcardId: p.jobcardId,
        workerId: p.workerId,
        url: p.url,
        note: p.note,
        takenAt: p.takenAt,
      }));
    const pending: DisplayPhoto[] = pendingPhotos
      .filter((p) => p.jobId === jobId)
      .map((p) => ({
        id: p.id,
        jobId: p.jobId,
        jobcardId: p.jobcardId,
        workerId: p.workerId,
        url: p.localUri,
        note: p.note,
        takenAt: p.takenAt,
        pending: p.state,
      }));
    return [...uploaded, ...pending].sort((a, b) =>
      b.takenAt.localeCompare(a.takenAt)
    );
  }, [jobId, jobPhotos, pendingPhotos]);
}

/**
 * Every photo linked to one jobcard (the installer shots taken from its
 * screen), uploaded + this device's queued ones, newest first. Used by the
 * Field Super's jobcard view.
 */
export function useJobcardPhotos(jobcardId: string | undefined): DisplayPhoto[] {
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  return useMemo(() => {
    if (!jobcardId) return [];
    const uploaded: DisplayPhoto[] = jobPhotos
      .filter((p) => p.jobcardId === jobcardId)
      .map((p) => ({
        id: p.id,
        jobId: p.jobId,
        jobcardId: p.jobcardId,
        workerId: p.workerId,
        url: p.url,
        note: p.note,
        takenAt: p.takenAt,
      }));
    const pending: DisplayPhoto[] = pendingPhotos
      .filter((p) => p.jobcardId === jobcardId)
      .map((p) => ({
        id: p.id,
        jobId: p.jobId,
        jobcardId: p.jobcardId,
        workerId: p.workerId,
        url: p.localUri,
        note: p.note,
        takenAt: p.takenAt,
        pending: p.state,
      }));
    return [...uploaded, ...pending].sort((a, b) =>
      b.takenAt.localeCompare(a.takenAt)
    );
  }, [jobcardId, jobPhotos, pendingPhotos]);
}
