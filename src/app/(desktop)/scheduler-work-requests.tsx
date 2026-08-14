import { useMemo } from 'react';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { WorkRequestsScreen } from '@/components/desktop/WorkRequestsScreen';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { activeJobs } from '@/utils/jobArchive';

/**
 * Scheduler → Work Requests: unlike the Field Super, the Scheduler isn't scoped to
 * particular jobs — they see and create work requests across every job.
 * (Archived jobs — and with them their work requests — are excluded.)
 */
export default function SchedulerWorkRequestsScreen() {
  const role = useCurrentRole();
  const allJobs = useAppStore((s) => s.jobs);
  const jobs = useMemo(() => activeJobs(allJobs), [allJobs]);

  if (role !== 'scheduler') return <AccessDenied />;

  return <WorkRequestsScreen jobs={jobs} />;
}
