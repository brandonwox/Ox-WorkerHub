import { Feather } from '@expo/vector-icons';

import { AppRole } from '@/types';

/** Human-readable role names. */
export const ROLE_LABELS: Record<AppRole, string> = {
  installer: 'Installer',
  scheduler: 'Scheduler',
  operator: 'Operator',
  project_manager: 'Project Manager',
  developer: 'Developer',
};

/** Roles that get the wide desktop sidebar console (everyone except installers). */
export type DesktopRole = Exclude<AppRole, 'installer'>;

export interface DesktopNavItem {
  href: '/schedule' | '/jobs' | '/people' | '/review' | '/pm' | '/pm-jobs';
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

/**
 * Sidebar sections each desktop role sees. The Operator's "Timesheets" review
 * lives at /review so it doesn't collide with the Installer's /timesheets.
 * Scheduler and Project Manager are placeholders for now.
 */
export const DESKTOP_NAV: Record<DesktopRole, DesktopNavItem[]> = {
  operator: [
    { href: '/jobs', label: 'Jobs', icon: 'briefcase' },
    { href: '/people', label: 'People', icon: 'users' },
    { href: '/review', label: 'Timesheets', icon: 'file-text' },
  ],
  scheduler: [{ href: '/schedule', label: 'Schedule', icon: 'calendar' }],
  project_manager: [
    // Distinct route from the Operator's '/jobs' but shown to the PM as "Jobs".
    { href: '/pm-jobs', label: 'Jobs', icon: 'briefcase' },
    { href: '/pm', label: 'Jobcards', icon: 'clipboard' },
  ],
  // Developer has no console of its own — it always views the app *as* another
  // role via the switcher, so this nav is only a type-required fallback.
  developer: [{ href: '/jobs', label: 'Jobs', icon: 'briefcase' }],
};

/** Landing route for a role — used by the role gate to redirect on sign-in/switch. */
export function roleHomeHref(
  role: AppRole
): '/' | '/schedule' | '/jobs' | '/pm' {
  switch (role) {
    case 'operator':
      return '/jobs';
    case 'scheduler':
      return '/schedule';
    case 'project_manager':
      return '/pm';
    case 'developer':
      return '/jobs';
    default:
      return '/';
  }
}

/** Desktop roles use the wide sidebar shell; installers use the mobile tabs. */
export function isDesktopRole(role: AppRole): role is DesktopRole {
  return role !== 'installer';
}
