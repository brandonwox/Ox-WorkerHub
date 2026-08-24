import { useLocalSearchParams } from 'expo-router';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CalendarBoard } from '@/components/desktop/scheduler/CalendarBoard';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * Scheduler → Calendar. `openCard` (a work request id, from clicking a "New
 * Priority Work Request" notification) opens that card's quick view on arrival;
 * `showCard` (from the quick view's "Show in calendar" button) reveals that
 * card on the board and blinks its chip instead. `oc`/`sc` are nonces so
 * repeating the same card re-fires.
 */
export default function ScheduleScreen() {
  const role = useCurrentRole();
  const { openCard, oc, showCard, sc } = useLocalSearchParams<{
    openCard?: string;
    oc?: string;
    showCard?: string;
    sc?: string;
  }>();
  if (role !== 'scheduler') return <AccessDenied />;
  return (
    <CalendarBoard
      canAssign
      openCardId={typeof openCard === 'string' ? openCard : undefined}
      openCardNonce={typeof oc === 'string' ? oc : undefined}
      showCardId={typeof showCard === 'string' ? showCard : undefined}
      showCardNonce={typeof sc === 'string' ? sc : undefined}
    />
  );
}
