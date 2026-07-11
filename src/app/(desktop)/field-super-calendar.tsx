import { useLocalSearchParams } from 'expo-router';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CalendarBoard } from '@/components/desktop/scheduler/CalendarBoard';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * Field Super → Calendar: the same board the Scheduler uses, but read-only for
 * crew assignment. Field Supers can view the schedule and open / edit jobcards,
 * they just can't place work onto crews.
 *
 * `highlight` (yyyy-MM-dd, from a jobcard row's "View on calendar") jumps the
 * calendar to that month and flashes the day for a few seconds; `hl` is a nonce
 * so repeating the same date still re-fires it.
 */
export default function FieldSuperCalendarScreen() {
  const role = useCurrentRole();
  const { highlight, hl } = useLocalSearchParams<{
    highlight?: string;
    hl?: string;
  }>();
  if (role !== 'field_super') return <AccessDenied />;
  return (
    <CalendarBoard
      canAssign={false}
      highlightDate={typeof highlight === 'string' ? highlight : undefined}
      highlightNonce={typeof hl === 'string' ? hl : undefined}
    />
  );
}
