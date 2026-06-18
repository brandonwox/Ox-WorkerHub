import { Redirect, Slot } from 'expo-router';

import { SidebarShell } from '@/components/desktop/SidebarShell';
import { DESKTOP_NAV } from '@/roles';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';

/** Wide desktop console for the Scheduler and Operator roles. */
export default function DesktopLayout() {
  const role = useCurrentRole();
  const authWorker = useAppStore((s) => s.authWorker);

  // Invited workers must set a password before using the app.
  if (authWorker?.status === 'invited') {
    return <Redirect href="/set-password" />;
  }

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
