import { Redirect, Slot, usePathname } from 'expo-router';
import { Platform } from 'react-native';

import { SidebarShell } from '@/components/desktop/SidebarShell';
import { NotificationToaster } from '@/components/NotificationToaster';
import { DESKTOP_NAV, roleCanAccessPath, roleHomeHref } from '@/roles';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';

/** Wide desktop console — the web layout for every role. */
export default function DesktopLayout() {
  const authResolved = useAppStore((s) => s.authResolved);
  const authWorker = useAppStore((s) => s.authWorker);
  const passwordRecovery = useAppStore((s) => s.passwordRecovery);
  const worker = useCurrentWorker();
  const pathname = usePathname();

  // Wait for the Supabase session to resolve before deciding, so a returning
  // user isn't flashed the login screen on launch.
  if (!authResolved) return null;

  // No identity (signed out, and not in local dev mode) → require sign-in.
  if (!worker) return <Redirect href="/sign-in" />;

  // Invited workers (setting up) and recovery-link sessions (resetting) both
  // need the password screen before anything else.
  if (authWorker?.status === 'invited' || passwordRecovery) {
    return <Redirect href="/set-password" />;
  }

  // The split is by form factor, not role: phones/tablets get the mobile tabs,
  // the web build gets this console.
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }

  // Landed on another role's page (e.g. an Operator opening /schedule) → send
  // them back to their own home, where their role has access.
  const role = worker.role;
  if (!roleCanAccessPath(role, pathname)) {
    return <Redirect href={roleHomeHref(role)} />;
  }

  return (
    <SidebarShell navItems={DESKTOP_NAV[role]}>
      <Slot />
      <NotificationToaster />
    </SidebarShell>
  );
}
