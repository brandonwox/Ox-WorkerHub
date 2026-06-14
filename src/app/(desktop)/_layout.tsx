import { Redirect, Slot } from 'expo-router';

import { SidebarShell } from '@/components/desktop/SidebarShell';
import { DESKTOP_NAV } from '@/roles';
import { useCurrentRole } from '@/store/useAppStore';

/** Wide desktop console for the Scheduler and Operator roles. */
export default function DesktopLayout() {
  const role = useCurrentRole();

  // Installers belong in the mobile tabs, not the desktop console.
  if (role === 'installer') {
    return <Redirect href="/" />;
  }

  return (
    <SidebarShell navItems={DESKTOP_NAV[role]}>
      <Slot />
    </SidebarShell>
  );
}
