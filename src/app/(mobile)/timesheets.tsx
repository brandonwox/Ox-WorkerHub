import { AccessDenied } from '@/components/desktop/AccessDenied';
import { InstallerTimesheets } from '@/components/mobile/InstallerTimesheets';
import { OperatorTimesheetsMobile } from '@/components/mobile/OperatorTimesheetsMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** Timesheets tab — the installer's own hours, or the Operator's review. */
export default function TimesheetsTab() {
  const role = useCurrentRole();
  if (role === 'installer') return <InstallerTimesheets />;
  if (role === 'operator') return <OperatorTimesheetsMobile />;
  return <AccessDenied />;
}
