import { useMemo } from 'react';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { JobcardsScreen } from '@/components/desktop/JobcardsScreen';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';

/** Field Super → Jobcards: every jobcard on their own jobs, and creation. */
export default function FieldSuperJobcardsScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);

  // A Field Super works only within their own jobs — and, transitively, only
  // the jobcards that hang off those jobs. Scoping here means the shared
  // screen only ever sees this Field Super's slice.
  const jobs = useMemo(
    () => (me ? jobsForFieldSuper(allJobs, me.id) : []),
    [allJobs, me]
  );

  if (role !== 'field_super') return <AccessDenied />;

  return <JobcardsScreen jobs={jobs} />;
}
