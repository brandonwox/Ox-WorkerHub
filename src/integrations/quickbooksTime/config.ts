import Constants from 'expo-constants';

import { QbtConfig } from '@/types';

/** QuickBooks Time (formerly TSheets) REST API base. */
export const DEFAULT_QBT_BASE_URL = 'https://rest.tsheets.com/api/v1';

/**
 * Build-time defaults read from app.json -> expo.extra.quickbooksTime. This is
 * where you paste the API access token so it ships with the build; everything
 * here can also be overridden at runtime from the Settings screen.
 *
 *   "extra": {
 *     "quickbooksTime": {
 *       "accessToken": "xxxxxxxx",
 *       "baseUrl": "https://rest.tsheets.com/api/v1",
 *       "autoSync": true,
 *       "defaultJobcodeId": 12345,
 *       "jobcodeMap": { "job:j-1": 12345, "custom:shop fabrication": 67890 }
 *     }
 *   }
 */
interface QbtExtra {
  accessToken?: string;
  baseUrl?: string;
  autoSync?: boolean;
  defaultJobcodeId?: number;
  jobcodeMap?: Record<string, number>;
}

function qbtExtra(): QbtExtra {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    quickbooksTime?: QbtExtra;
  };
  return extra.quickbooksTime ?? {};
}

/** Seed config for the store, merging app.json defaults with sane fallbacks. */
export function defaultQbtConfig(): QbtConfig {
  const extra = qbtExtra();
  return {
    accessToken: (extra.accessToken ?? '').trim(),
    baseUrl: (extra.baseUrl ?? '').trim() || DEFAULT_QBT_BASE_URL,
    autoSync: extra.autoSync ?? false,
  };
}

/** Build-time jobcode mappings (log reference key -> jobcode id). */
export function defaultJobcodeMap(): Record<string, number> {
  return qbtExtra().jobcodeMap ?? {};
}

/** Build-time fallback jobcode used when a log has no specific mapping. */
export function defaultJobcodeId(): number | undefined {
  // app.json uses `null` for "unset"; normalise that to undefined.
  const id = qbtExtra().defaultJobcodeId;
  return typeof id === 'number' ? id : undefined;
}
