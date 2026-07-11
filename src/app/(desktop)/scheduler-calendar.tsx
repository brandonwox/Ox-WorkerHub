import { useLocalSearchParams } from 'expo-router';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CalendarBoard } from '@/components/desktop/scheduler/CalendarBoard';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * Scheduler → Calendar. `openCard` (a jobcard id, from clicking a "New
 * Priority Jobcard" notification) opens that card's quick view on arrival;
 * `oc` is a nonce so re-clicking the same notification re-opens it.
 */
export default function ScheduleScreen() {
  const role = useCurrentRole();
  const { openCard, oc } = useLocalSearchParams<{
    openCard?: string;
    oc?: string;
  }>();
  if (role !== 'scheduler') return <AccessDenied />;
  return (
    <CalendarBoard
      canAssign
      openCardId={typeof openCard === 'string' ? openCard : undefined}
      openCardNonce={typeof oc === 'string' ? oc : undefined}
    />
  );
}
