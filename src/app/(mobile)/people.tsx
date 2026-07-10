import { AccessDenied } from '@/components/desktop/AccessDenied';
import { OperatorPeopleMobile } from '@/components/mobile/OperatorPeopleMobile';
import { useCurrentRole } from '@/store/useAppStore';

/** People tab — the Operator's roster. */
export default function PeopleTab() {
  const role = useCurrentRole();
  if (role === 'operator') return <OperatorPeopleMobile />;
  return <AccessDenied />;
}
