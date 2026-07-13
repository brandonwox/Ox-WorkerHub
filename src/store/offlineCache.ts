import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subDays } from 'date-fns';
import { Image } from 'expo-image';
import { Platform } from 'react-native';

import {
  Crew,
  DailyCrew,
  Job,
  Jobcard,
  JobDocument,
  JobIssue,
  ScheduleAssignment,
  TimesheetLog,
  Worker,
} from '@/types';

/**
 * On-device read cache so the app opens with data even with no signal.
 *
 * Every successful Supabase fetch mirrors the collections here (keyed per
 * worker); a cold launch hydrates from this cache instantly and the live fetch
 * replaces it when a connection exists. Photos are deliberately EXCLUDED —
 * offline photo areas show a "connect to the internet" message instead — with
 * one exception: flashing-material reference photos are prefetched into
 * expo-image's disk cache so they still render on site (see
 * prefetchFlashingPhotos).
 */

const DATA_CACHE_PREFIX = 'oxwh.dataCache.';
const AUTH_WORKER_PREFIX = 'oxwh.authWorker.';

/** Timesheets older than this stay out of the cache to keep it lean. */
const LOG_CACHE_DAYS = 90;

/** The collections worth having offline (photos intentionally absent). */
export interface CachedCollections {
  workers: Worker[];
  jobs: Job[];
  jobcards: Jobcard[];
  crews: Crew[];
  dailyCrews: DailyCrew[];
  assignments: ScheduleAssignment[];
  logs: TimesheetLog[];
  jobIssues: JobIssue[];
  /**
   * Document rows (titles/text bodies cache fine; photo/pdf files still need
   * a connection to open, like job photos). Absent in caches written before
   * the documents feature — readers default to [].
   */
  jobDocuments?: JobDocument[];
  cachedAt: string;
}

/** Mirror the collections to this worker's cache slot (fire-and-forget). */
export function persistDataCache(
  workerId: string,
  data: Omit<CachedCollections, 'cachedAt'>
): void {
  const cutoff = format(subDays(new Date(), LOG_CACHE_DAYS), 'yyyy-MM-dd');
  // Fields picked one by one (not spread) so a caller passing the full fetch
  // payload can never sneak photos or other extras onto the disk cache.
  const payload: CachedCollections = {
    workers: data.workers,
    jobs: data.jobs,
    jobcards: data.jobcards,
    crews: data.crews,
    dailyCrews: data.dailyCrews,
    assignments: data.assignments,
    logs: data.logs.filter(
      (log) => (log.date ?? log.startTime.slice(0, 10)) >= cutoff
    ),
    jobIssues: data.jobIssues,
    jobDocuments: data.jobDocuments,
    cachedAt: new Date().toISOString(),
  };
  AsyncStorage.setItem(
    DATA_CACHE_PREFIX + workerId,
    JSON.stringify(payload)
  ).catch(() => {});
}

/** This worker's last-fetched collections, or null when never cached. */
export async function loadDataCache(
  workerId: string
): Promise<CachedCollections | null> {
  try {
    const raw = await AsyncStorage.getItem(DATA_CACHE_PREFIX + workerId);
    return raw ? (JSON.parse(raw) as CachedCollections) : null;
  } catch {
    return null;
  }
}

/**
 * Remember the signed-in worker's own row so a cold offline launch can still
 * resolve WHO they are (their persisted auth session says only the user id).
 */
export function persistAuthWorker(worker: Worker): void {
  AsyncStorage.setItem(
    AUTH_WORKER_PREFIX + worker.id,
    JSON.stringify(worker)
  ).catch(() => {});
}

/** The cached identity for a stored session's user id, or null. */
export async function loadCachedAuthWorker(
  userId: string
): Promise<Worker | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_WORKER_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Worker) : null;
  } catch {
    return null;
  }
}

/**
 * Pull every job's flashing-material reference photo into expo-image's disk
 * cache so it renders offline — the one kind of photo that must work on site.
 * Web is skipped (the browser's HTTP cache handles it there).
 */
export function prefetchFlashingPhotos(jobs: Job[]): void {
  if (Platform.OS === 'web') return;
  const urls = jobs
    .map((job) => job.flashingPhotoUrl)
    .filter((url): url is string => !!url);
  if (urls.length > 0) void Image.prefetch(urls);
}
