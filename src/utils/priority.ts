import { PRIORITY_PRESETS } from '@/types';
import { colors, themed } from '@/theme';

const PRESET_ORDER = PRIORITY_PRESETS as readonly string[];

/**
 * Legacy Low/Medium/High cards predate the preset scale. Slot them between the
 * presets so a mixed backlog still sorts sensibly (High ≈ urgent, Low ≈ bottom).
 */
const LEGACY_RANK: Record<string, number> = {
  High: 0.5,
  Medium: 2,
  Low: 3.5,
};

/**
 * Sort key for a priority — LOWER is more urgent (sorts to the top). Presets
 * rank by their declared order; legacy values slot in between; unknown/custom
 * priorities sink below every known value.
 */
export function priorityRank(priority: string): number {
  const i = PRESET_ORDER.indexOf(priority);
  if (i !== -1) return i;
  if (priority in LEGACY_RANK) return LEGACY_RANK[priority];
  return PRESET_ORDER.length + 1;
}

const PRIORITY_COLOR: Record<string, string> = themed(() => ({
  Now: colors.danger,
  Tomorrow: colors.warning,
  'This Week': colors.primary,
  'Low Priority': colors.textTertiary,
  // Range-based selector labels (see PRIORITY_CHOICES / priorityRange.ts).
  'This week': colors.warning,
  'Next week': colors.primary,
  'Set dates': colors.textSecondary,
  // Legacy values map onto the same accent scale.
  High: colors.danger,
  Medium: colors.warning,
  Low: colors.textTertiary,
}));

/** Accent color for a priority badge/dot; falls back to a neutral grey. */
export function priorityColor(priority: string): string {
  return PRIORITY_COLOR[priority] ?? colors.textSecondary;
}
