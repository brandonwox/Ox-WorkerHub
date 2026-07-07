import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CalendarBoard } from '@/components/desktop/scheduler/CalendarBoard';
import { useCurrentRole } from '@/store/useAppStore';

export default function ScheduleScreen() {
  const role = useCurrentRole();
  if (role !== 'scheduler') return <AccessDenied />;
  return <CalendarBoard canAssign />;
}
