import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CalendarBoard } from '@/components/desktop/scheduler/CalendarBoard';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * Field Super → Calendar: the same board the Scheduler uses, but read-only for
 * crew assignment. Field Supers can view the schedule and open / edit jobcards,
 * they just can't place work onto crews.
 */
export default function FieldSuperCalendarScreen() {
  const role = useCurrentRole();
  if (role !== 'field_super') return <AccessDenied />;
  return <CalendarBoard canAssign={false} />;
}
