import { AccessDenied } from '@/components/desktop/AccessDenied';
import { JobcardsScreen } from '@/components/desktop/JobcardsScreen';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';

/**
 * Scheduler → Jobcards: unlike the Field Super, the Scheduler isn't scoped to
 * particular jobs — they see and create jobcards across every job.
 */
export default function SchedulerJobcardsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);

  if (role !== 'scheduler') return <AccessDenied />;

  return <JobcardsScreen jobs={jobs} />;
}
