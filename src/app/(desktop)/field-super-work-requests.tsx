import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { WorkRequestsScreen } from '@/components/desktop/WorkRequestsScreen';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';

/** Field Super → Work Requests: every work request on their own jobs, and creation. */
export default function FieldSuperWorkRequestsScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);
  const router = useRouter();

  // A Field Super works only within their own jobs — and, transitively, only
  // the work requests that hang off those jobs. Scoping here means the shared
  // screen only ever sees this Field Super's slice.
  const jobs = useMemo(
    () => (me ? jobsForFieldSuper(allJobs, me.id) : []),
    [allJobs, me]
  );

  if (role !== 'field_super') return <AccessDenied />;

  return (
    <WorkRequestsScreen
      jobs={jobs}
      showFalseStarts
      onViewCalendar={(date) =>
        // `hl` is a nonce so re-clicking the same date re-fires the highlight.
        router.push({
          pathname: '/field-super-calendar',
          params: { highlight: date, hl: Date.now().toString() },
        })
      }
    />
  );
}
