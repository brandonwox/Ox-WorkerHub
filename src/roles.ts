import { Feather } from '@expo/vector-icons';
import {
  Briefcase,
  CalendarDays,
  FileText,
  type LucideIcon,
  NotepadText,
  Users,
} from 'lucide-react-native';
import { Platform } from 'react-native';

import { AppRole } from '@/types';

/** Human-readable role names. */
export const ROLE_LABELS: Record<AppRole, string> = {
  installer: 'Installer',
  scheduler: 'Scheduler',
  operator: 'Operator',
  field_super: 'Field Super',
  finance_manager: 'Finance Manager',
  developer: 'Developer',
};

/**
 * The app splits by FORM FACTOR, not by role: native (iOS/Android) renders the
 * mobile tab layout in `(mobile)`, web renders the desktop sidebar console in
 * `(desktop)`. Every role has a home in both.
 */

/**
 * Every desktop page is role-prefixed so each route is owned by exactly one
 * role (e.g. the Operator's Jobs lives at /operator-jobs, the Field Super's at
 * /field-super-jobs).
 * Universal routes (/sign-in, /set-password, the /work-request/[id] modal) are not listed.
 */
export type DesktopHref =
  | '/scheduler-overview'
  | '/scheduler-calendar'
  | '/scheduler-jobs'
  | '/scheduler-work-requests'
  | '/operator-jobs'
  | '/operator-people'
  | '/finance-manager-jobs'
  | '/finance-manager-timesheets'
  | '/field-super-overview'
  | '/field-super-work-requests'
  | '/field-super-jobs'
  | '/field-super-calendar'
  | '/installer-schedule'
  | '/installer-timesheets'
  | '/installer-pics'
  // The one shared page: every role gets the same Settings. Named
  // 'console-settings' because the mobile tab already owns '/settings' and
  // route groups don't namespace URLs.
  | '/console-settings';

export interface DesktopNavItem {
  href: DesktopHref;
  label: string;
  /** Lucide icon component (the sidebar renders lucide, not Feather). */
  icon: LucideIcon;
}

/**
 * Sidebar sections each role sees on the desktop (web) console. Settings is
 * deliberately absent — it's reached via the top-right profile chip
 * (AuthControl), not the sidebar.
 */
export const DESKTOP_NAV: Record<AppRole, DesktopNavItem[]> = {
  installer: [
    { href: '/installer-schedule', label: 'Schedule', icon: CalendarDays },
    { href: '/installer-timesheets', label: 'Timesheets', icon: FileText },
    // No live camera on web — the page offers file upload instead.
    { href: '/installer-pics', label: 'Jobs', icon: Briefcase },
  ],
  operator: [
    { href: '/operator-jobs', label: 'Jobs', icon: Briefcase },
    { href: '/operator-people', label: 'People', icon: Users },
  ],
  // Money-facing console: labor budgets + QBT mapping on jobs, and the
  // timesheet review the Operator used to own.
  finance_manager: [
    { href: '/finance-manager-jobs', label: 'Jobs', icon: Briefcase },
    {
      href: '/finance-manager-timesheets',
      label: 'Timesheets',
      icon: FileText,
    },
  ],
  scheduler: [
    // Overview is disabled for now (nav entry removed, page kept) — see
    // Dev Tracker. Calendar is the landing page instead.
    { href: '/scheduler-calendar', label: 'Calendar', icon: CalendarDays },
    // Every job (schedulers aren't scoped) — job dashboards + job creation.
    { href: '/scheduler-jobs', label: 'Jobs', icon: Briefcase },
    // Distinct route from the Field Super's '/field-super-work-requests' — the
    // Scheduler creates work requests across every job, not just their own.
    { href: '/scheduler-work-requests', label: 'Work Requests', icon: NotepadText },
  ],
  field_super: [
    // Overview is disabled for now (nav entry removed, page kept) — see
    // Dev Tracker. Jobs is the landing page instead.
    // Distinct route from the Operator's '/operator-jobs', shown to the Field
    // Super as "Jobs".
    { href: '/field-super-jobs', label: 'Jobs', icon: Briefcase },
    { href: '/field-super-work-requests', label: 'Work Requests', icon: NotepadText },
    { href: '/field-super-calendar', label: 'Calendar', icon: CalendarDays },
  ],
  // Developer has no console of its own — it always views the app *as* another
  // role via the switcher, so this nav is only a type-required fallback.
  developer: [
    { href: '/operator-jobs', label: 'Jobs', icon: Briefcase },
  ],
};

/**
 * Mobile tab routes are generic (one file per tab in `(mobile)`), shared across
 * roles: `index` is each role's home and screens branch by role inside. Names
 * never collide with the role-prefixed desktop routes.
 */
export type MobileTabName =
  | 'index'
  | 'overview'
  | 'timesheets'
  | 'people'
  | 'backlog'
  | 'jobs'
  | 'calendar'
  | 'pics'
  | 'settings';

/** Every tab file in the `(mobile)` group — used to declare and gate them. */
export const MOBILE_TAB_NAMES: MobileTabName[] = [
  'index',
  'overview',
  'timesheets',
  'people',
  'backlog',
  'jobs',
  'calendar',
  'pics',
  'settings',
];

export interface MobileNavItem {
  name: MobileTabName;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

/** Tabs each role sees on the phone, in tab-bar order. `index` is always present. */
export const MOBILE_NAV: Record<AppRole, MobileNavItem[]> = {
  installer: [
    { name: 'timesheets', label: 'Timesheets', icon: 'file-text' },
    { name: 'index', label: 'Calendar', icon: 'calendar' },
    // The former "Pics" tab — now the installer's job dashboard (route file
    // stays pics.tsx; the field_super already owns the 'jobs' tab name).
    { name: 'pics', label: 'Jobs', icon: 'briefcase' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ],
  scheduler: [
    // Overview is disabled for now (tab removed, page kept) — see Dev Tracker.
    { name: 'index', label: 'Calendar', icon: 'calendar' },
    { name: 'backlog', label: 'Backlog', icon: 'inbox' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ],
  operator: [
    { name: 'index', label: 'Jobs', icon: 'briefcase' },
    { name: 'people', label: 'People', icon: 'users' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ],
  finance_manager: [
    { name: 'index', label: 'Jobs', icon: 'briefcase' },
    { name: 'timesheets', label: 'Timesheets', icon: 'file-text' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ],
  field_super: [
    // Overview is disabled for now (tab removed, page kept) — see Dev Tracker.
    { name: 'index', label: 'Work Requests', icon: 'clipboard' },
    { name: 'jobs', label: 'Jobs', icon: 'briefcase' },
    { name: 'calendar', label: 'Calendar', icon: 'calendar' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ],
  // The Developer picks a role to view as from Settings; until then the home
  // tab shows a pointer there.
  developer: [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'settings', label: 'Settings', icon: 'settings' },
  ],
};

/** URL path a mobile tab renders at (`index` is the group root). */
export function mobilePathForTab(name: MobileTabName): string {
  return name === 'index' ? '/' : `/${name}`;
}

/** Landing route for a role on the desktop (web) console. */
export function desktopHomeHref(role: AppRole): DesktopHref {
  switch (role) {
    case 'installer':
      return '/installer-schedule';
    case 'operator':
      return '/operator-jobs';
    // Overview is disabled for now — Schedulers land on the Calendar, Field
    // Supers on their Jobs.
    case 'scheduler':
      return '/scheduler-calendar';
    case 'field_super':
      return '/field-super-jobs';
    case 'finance_manager':
      return '/finance-manager-jobs';
    case 'developer':
      return '/operator-jobs';
  }
}

/**
 * Landing route for a role on the current platform — the desktop console home
 * on web, the mobile home tab on iOS/Android. Used by the gates to redirect on
 * sign-in/switch.
 */
export function roleHomeHref(role: AppRole): '/' | DesktopHref {
  return Platform.OS === 'web' ? desktopHomeHref(role) : '/';
}

/**
 * Every desktop route a role is allowed to open. Settings is accessible to
 * every role even though no sidebar lists it (it's reached via the top-right
 * profile chip) — without this the layout's route gate would bounce the
 * chip's navigation straight back home.
 */
export function desktopAccessibleHrefs(role: AppRole): DesktopHref[] {
  const shared: DesktopHref[] = ['/console-settings'];
  // Developer roams the whole console (it views *as* other roles for testing),
  // so it isn't gated to a single role's nav.
  if (role === 'developer') {
    return [
      ...Object.values(DESKTOP_NAV)
        .flat()
        .map((item) => item.href),
      ...shared,
    ];
  }
  return [...DESKTOP_NAV[role].map((item) => item.href), ...shared];
}

/**
 * Whether `role` may view desktop `pathname`. Matches a nav href exactly or as
 * a path prefix (so `/operator-jobs/123` still counts as that section), while
 * keeping distinct routes like `/operator-jobs` and `/field-super-jobs` apart.
 */
export function roleCanAccessPath(role: AppRole, pathname: string): boolean {
  return desktopAccessibleHrefs(role).some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}

/**
 * Whether `role` may view the mobile tab at `pathname`. Only polices known tab
 * paths — anything else (/work-request/[id], /sign-in, …) is outside the tab bar's
 * jurisdiction and always allowed.
 */
export function roleCanAccessMobilePath(role: AppRole, pathname: string): boolean {
  const isTabPath = MOBILE_TAB_NAMES.some(
    (name) => mobilePathForTab(name) === pathname
  );
  if (!isTabPath) return true;
  return MOBILE_NAV[role].some((item) => mobilePathForTab(item.name) === pathname);
}
