import { AccessDenied } from '@/components/desktop/AccessDenied';
import { FieldSuperJobsMobile } from '@/components/mobile/FieldSuperJobsMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** Jobs tab — the Field Super's jobsites. */
export default function JobsTab() {
  const role = useCurrentRole();
  if (role === 'field_super') return <FieldSuperJobsMobile />;
  return <AccessDenied />;
}
