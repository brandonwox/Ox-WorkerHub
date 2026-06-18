import { Redirect, Slot } from 'expo-router';

import { SidebarShell } from '@/components/desktop/SidebarShell';
import { DESKTOP_NAV } from '@/roles';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';

/** Wide desktop console for the Scheduler and Operator roles. */
export default function DesktopLayout() {
  const authResolved = useAppStore((s) => s.authResolved);
  const authWorker = useAppStore((s) => s.authWorker);
  const worker = useCurrentWorker();

  // Wait for the Supabase session to resolve before deciding, so a returning
  // user isn't flashed the login screen on launch.
  if (!authResolved) return null;

  // No identity (signed out, and not in local dev mode) → require sign-in.
  if (!worker) return <Redirect href="/sign-in" />;

  // Invited workers must set a password before using the app.
  if (authWorker?.status === 'invited') {
    return <Redirect href="/set-password" />;
  }

  // Installers belong in the mobile tabs, not the desktop console.
  const role = worker.role;
  if (role === 'installer') {
    return <Redirect href="/" />;
  }

  return (
    <SidebarShell navItems={DESKTOP_NAV[role]}>
      <Slot />
    </SidebarShell>
  );
}
