import { Platform } from 'react-native';

import { AppNotification, AppRole } from '@/types';

export interface NotificationTarget {
  pathname: string;
  params?: Record<string, string>;
}

/**
 * Where clicking/tapping a notification should take the recipient, or null
 * when it has no destination (e.g. `save_failed`, `qbt_push_result`). Every
 * notification row and toast routes through this — one map, no per-surface
 * special cases.
 *
 *  - Work-request notifications open the universal work request page.
 *    Exception: the scheduler's "Now" ping keeps its richer jump — the
 *    calendar with that card's quick view open (`oc`/`oj` are nonces so
 *    re-clicking a notification for the same target re-opens it).
 *  - Job notifications open the job: the mobile job details page on native,
 *    or the role's jobs page on web with `openJob` popping the job's
 *    dashboard sidebar (the Finance Manager's jobs page has no sidebar, so
 *    theirs just lands on the list).
 */
export function notificationTarget(
  n: AppNotification,
  role: AppRole | null
): NotificationTarget | null {
  const workRequestId =
    typeof n.data?.workRequestId === 'string' ? n.data.workRequestId : undefined;
  const jobId = typeof n.data?.jobId === 'string' ? n.data.jobId : undefined;
  const nonce = Date.now().toString();

  if (
    n.type === 'work_request_now' &&
    role === 'scheduler' &&
    Platform.OS === 'web' &&
    workRequestId
  ) {
    return {
      pathname: '/scheduler-calendar',
      params: { openCard: workRequestId, oc: nonce },
    };
  }
  if (workRequestId) {
    return { pathname: '/work-request/[id]', params: { id: workRequestId } };
  }
  if (jobId) {
    if (Platform.OS !== 'web') {
      return { pathname: '/job-site/[id]', params: { id: jobId } };
    }
    const jobsPage: Partial<Record<AppRole, string>> = {
      scheduler: '/scheduler-jobs',
      operator: '/operator-jobs',
      field_super: '/field-super-jobs',
      finance_manager: '/finance-manager-jobs',
    };
    const pathname = role ? jobsPage[role] : undefined;
    return pathname
      ? { pathname, params: { openJob: jobId, oj: nonce } }
      : null;
  }
  return null;
}
