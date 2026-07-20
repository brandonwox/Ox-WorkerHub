import { colors, themed } from '@/theme';

/** Pill colors for a Work Request priority. */
export interface PriorityMeta {
  bg: string;
  fg: string;
}

// Known presets (and legacy Low/Medium/High) map to a color; anything custom
// the Field Super types falls back to neutral.
const META = themed(() => {
  const NEUTRAL: PriorityMeta = {
    bg: colors.surfaceLight,
    fg: colors.textSecondary,
  };
  const URGENT: PriorityMeta = { bg: colors.dangerDim, fg: colors.danger };
  const SOON: PriorityMeta = { bg: colors.warningDim, fg: colors.warning };
  const NORMAL: PriorityMeta = { bg: colors.primaryDim, fg: colors.primary };
  const byPriority: Record<string, PriorityMeta> = {
    Now: URGENT,
    Tomorrow: SOON,
    'This Week': NORMAL,
    'Low Priority': NEUTRAL,
    // Range-based selector labels (see PRIORITY_CHOICES / priorityRange.ts).
    'This week': SOON,
    'Next week': NORMAL,
    'Set dates': NEUTRAL,
    // Legacy values from before priority became free text.
    High: URGENT,
    Medium: NORMAL,
    Low: NEUTRAL,
  };
  return { byPriority, neutral: NEUTRAL };
});

/** Resolve pill colors for any priority string, defaulting to neutral. */
export function priorityMeta(priority: string): PriorityMeta {
  return META.byPriority[priority] ?? META.neutral;
}
