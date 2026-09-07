import { Worker } from '@/types';

/**
 * Daily crew auto-naming: a daily crew is named after its members — short
 * names ("Brandon W & Timothy B") everywhere, and bare initials ("BW & TB")
 * where space is tight (the calendar chips' hover crew line).
 */

/** "Brandon Williams" → "Brandon W" (single-word names pass through as-is). */
export function installerShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`;
}

/** "Brandon Williams" → "BW" (single-word names → their first letter). */
export function installerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

const memberNames = (installerIds: string[], workers: Worker[]) =>
  installerIds
    .map((id) => workers.find((w) => w.id === id)?.name)
    .filter((name): name is string => !!name?.trim());

/**
 * The auto-generated daily crew name: every member's short name joined with
 * " & " — "Brandon W & Timothy B". Empty when no members resolve (the create
 * form requires at least one member, so this only happens on stale data).
 */
export function dailyCrewAutoName(
  installerIds: string[],
  workers: Worker[]
): string {
  return memberNames(installerIds, workers).map(installerShortName).join(' & ');
}

/**
 * The compact form for tight surfaces: member initials joined with " & " —
 * "BW & TB". Falls back to `fallbackName` (the stored name) when no members
 * resolve, e.g. a legacy hand-named crew whose roster changed.
 */
export function dailyCrewInitials(
  installerIds: string[],
  workers: Worker[],
  fallbackName: string
): string {
  const names = memberNames(installerIds, workers);
  if (names.length === 0) return fallbackName;
  return names.map(installerInitials).join(' & ');
}
