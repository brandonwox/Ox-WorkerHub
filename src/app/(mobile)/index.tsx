import { DeveloperHome } from '@/components/mobile/DeveloperHome';
import { FieldSuperJobcardsMobile } from '@/components/mobile/FieldSuperJobcardsMobile';
import { FinanceJobs } from '@/components/finance/FinanceJobs';
import { InstallerAgenda } from '@/components/mobile/InstallerAgenda';
import { OperatorJobsMobile } from '@/components/mobile/OperatorJobsMobile';
import { CrewCalendarMobile } from '@/components/mobile/CrewCalendarMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** Home tab — each role's main mobile surface. */
export default function HomeTab() {
  const role = useCurrentRole();
  switch (role) {
    case 'installer':
      return <InstallerAgenda />;
    case 'scheduler':
      return <CrewCalendarMobile canAssign />;
    case 'operator':
      return <OperatorJobsMobile />;
    case 'field_super':
      return <FieldSuperJobcardsMobile />;
    case 'finance_manager':
      return <FinanceJobs />;
    case 'developer':
      return <DeveloperHome />;
    default:
      // Gated by the layout; null only during the sign-out transition.
      return null;
  }
}
