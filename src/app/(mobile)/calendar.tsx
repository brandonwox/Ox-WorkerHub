import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CrewCalendarMobile } from '@/components/mobile/CrewCalendarMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** Calendar tab — the Field Super's read-only view of the crew calendar. */
export default function CalendarTab() {
  const role = useCurrentRole();
  if (role === 'field_super') return <CrewCalendarMobile canAssign={false} />;
  return <AccessDenied />;
}
