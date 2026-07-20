import { AccessDenied } from '@/components/desktop/AccessDenied';
import { SchedulerBacklogMobile } from '@/components/mobile/SchedulerBacklogMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** Backlog tab — the Scheduler's unassigned work requests. */
export default function BacklogTab() {
  const role = useCurrentRole();
  if (role === 'scheduler') return <SchedulerBacklogMobile />;
  return <AccessDenied />;
}
