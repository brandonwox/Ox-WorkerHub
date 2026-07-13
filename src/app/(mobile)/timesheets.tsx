import { AccessDenied } from '@/components/desktop/AccessDenied';
import { InstallerTimesheets } from '@/components/mobile/InstallerTimesheets';
import { OperatorTimesheetsMobile } from '@/components/mobile/OperatorTimesheetsMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** Timesheets tab — the installer's own hours, or the Finance Manager's
    review (taken over from the Operator). */
export default function TimesheetsTab() {
  const role = useCurrentRole();
  if (role === 'installer') return <InstallerTimesheets />;
  if (role === 'finance_manager') return <OperatorTimesheetsMobile />;
  return <AccessDenied />;
}
