import { DeveloperHome } from '@/components/mobile/DeveloperHome';
import { FieldSuperWorkRequestsMobile } from '@/components/mobile/FieldSuperWorkRequestsMobile';
import { FinanceJobs } from '@/components/finance/FinanceJobs';
import { InstallerAgenda } from '@/components/mobile/InstallerAgenda';
import { OperatorJobsMobile } from '@/components/mobile/OperatorJobsMobile';
import { CrewCalendarMobile } from '@/components/mobile/CrewCalendarMobile';
import { useLocalSearchParams } from 'expo-router';

import { useCurrentRole } from '@/store/useAppStore';

/** Home tab — each role's main mobile surface. */
export default function HomeTab() {
  const role = useCurrentRole();
  // A work request's "View on calendar" lands the Scheduler here with the day
  // to jump to (`hl` is a nonce so the same day re-fires).
  const { highlight, hl } = useLocalSearchParams<{
    highlight?: string;
    hl?: string;
  }>();
  switch (role) {
    case 'installer':
      return <InstallerAgenda />;
    case 'scheduler':
      return (
        <CrewCalendarMobile
          canAssign
          highlightDate={typeof highlight === 'string' ? highlight : undefined}
          highlightNonce={typeof hl === 'string' ? hl : undefined}
        />
      );
    case 'operator':
      return <OperatorJobsMobile />;
    case 'field_super':
      return <FieldSuperWorkRequestsMobile />;
    case 'finance_manager':
      return <FinanceJobs />;
    case 'developer':
      return <DeveloperHome />;
    default:
      // Gated by the layout; null only during the sign-out transition.
      return null;
  }
}
