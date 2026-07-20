import { AccessDenied } from '@/components/desktop/AccessDenied';
import { WorkRequestsScreen } from '@/components/desktop/WorkRequestsScreen';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';

/**
 * Scheduler → Work Requests: unlike the Field Super, the Scheduler isn't scoped to
 * particular jobs — they see and create work requests across every job.
 */
export default function SchedulerWorkRequestsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);

  if (role !== 'scheduler') return <AccessDenied />;

  return <WorkRequestsScreen jobs={jobs} />;
}
