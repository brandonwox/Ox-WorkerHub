import { useLocalSearchParams } from 'expo-router';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CrewCalendarMobile } from '@/components/mobile/CrewCalendarMobile';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * Calendar tab — the Field Super's read-only view of the crew calendar.
 * `highlight` (yyyy-MM-dd, from a work request's "View on calendar") jumps
 * the calendar to that day and flashes it; `hl` is a nonce so a repeat jump
 * to the same date re-fires.
 */
export default function CalendarTab() {
  const role = useCurrentRole();
  const { highlight, hl } = useLocalSearchParams<{
    highlight?: string;
    hl?: string;
  }>();
  if (role === 'field_super') {
    return (
      <CrewCalendarMobile
        canAssign={false}
        highlightDate={typeof highlight === 'string' ? highlight : undefined}
        highlightNonce={typeof hl === 'string' ? hl : undefined}
      />
    );
  }
  return <AccessDenied />;
}
