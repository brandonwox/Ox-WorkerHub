import { Feather } from '@expo/vector-icons';

import { AppRole } from '@/types';

/** Human-readable role names. */
export const ROLE_LABELS: Record<AppRole, string> = {
  installer: 'Installer',
  scheduler: 'Scheduler',
  operator: 'Operator',
  field_super: 'Field Super',
  developer: 'Developer',
};

/** Roles that get the wide desktop sidebar console (everyone except installers). */
export type DesktopRole = Exclude<AppRole, 'installer'>;

/**
 * Every page is role-prefixed so each route is owned by exactly one role
 * (e.g. the Operator's Jobs lives at /operator-jobs, the Field Super's at
 * /field-super-jobs).
 * Universal routes (/sign-in, /set-password, the /job/[id] modal) are not listed.
 */
export type DesktopHref =
  | '/scheduler-calendar'
  | '/operator-jobs'
  | '/operator-people'
  | '/operator-timesheets'
  | '/field-super-jobcards'
  | '/field-super-jobs'
  | '/field-super-calendar';

export interface DesktopNavItem {
  href: DesktopHref;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

/** Sidebar sections each desktop role sees. */
export const DESKTOP_NAV: Record<DesktopRole, DesktopNavItem[]> = {
  operator: [
    { href: '/operator-jobs', label: 'Jobs', icon: 'briefcase' },
    { href: '/operator-people', label: 'People', icon: 'users' },
    { href: '/operator-timesheets', label: 'Timesheets', icon: 'file-text' },
  ],
  scheduler: [{ href: '/scheduler-calendar', label: 'Calendar', icon: 'calendar' }],
  field_super: [
    // Distinct route from the Operator's '/operator-jobs', shown to the Field
    // Super as "Jobs".
    { href: '/field-super-jobs', label: 'Jobs', icon: 'briefcase' },
    { href: '/field-super-jobcards', label: 'Jobcards', icon: 'clipboard' },
    { href: '/field-super-calendar', label: 'Calendar', icon: 'calendar' },
  ],
  // Developer has no console of its own — it always views the app *as* another
  // role via the switcher, so this nav is only a type-required fallback.
  developer: [{ href: '/operator-jobs', label: 'Jobs', icon: 'briefcase' }],
};

/** Landing route for a role — used by the role gate to redirect on sign-in/switch. */
export function roleHomeHref(role: AppRole): '/' | DesktopHref {
  switch (role) {
    case 'operator':
      return '/operator-jobs';
    case 'scheduler':
      return '/scheduler-calendar';
    case 'field_super':
      return '/field-super-jobcards';
    case 'developer':
      return '/operator-jobs';
    default:
      return '/';
  }
}

/** Desktop roles use the wide sidebar shell; installers use the mobile tabs. */
export function isDesktopRole(role: AppRole): role is DesktopRole {
  return role !== 'installer';
}

/** Every desktop route a role is allowed to open. */
export function desktopAccessibleHrefs(role: DesktopRole): DesktopHref[] {
  // Developer roams the whole console (it views *as* other roles for testing),
  // so it isn't gated to a single role's nav.
  if (role === 'developer') {
    return [
      '/scheduler-calendar',
      '/operator-jobs',
      '/operator-people',
      '/operator-timesheets',
      '/field-super-jobcards',
      '/field-super-jobs',
      '/field-super-calendar',
    ];
  }
  return DESKTOP_NAV[role].map((item) => item.href);
}

/**
 * Whether `role` may view `pathname`. Matches a nav href exactly or as a path
 * prefix (so `/operator-jobs/123` still counts as that section), while keeping
 * distinct routes like `/operator-jobs` and `/field-super-jobs` apart.
 */
export function roleCanAccessPath(role: DesktopRole, pathname: string): boolean {
  return desktopAccessibleHrefs(role).some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}
