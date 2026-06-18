import { colors } from '@/theme';

/** Pill colors for a Jobcard priority. */
export interface PriorityMeta {
  bg: string;
  fg: string;
}

const NEUTRAL: PriorityMeta = {
  bg: colors.surfaceLight,
  fg: colors.textSecondary,
};
const URGENT: PriorityMeta = { bg: colors.dangerDim, fg: colors.danger };
const SOON: PriorityMeta = { bg: colors.warningDim, fg: colors.warning };
const NORMAL: PriorityMeta = { bg: colors.primaryDim, fg: colors.primary };

// Known presets (and legacy Low/Medium/High) map to a color; anything custom
// the PM types falls back to neutral.
const META: Record<string, PriorityMeta> = {
  Now: URGENT,
  Tomorrow: SOON,
  'This Week': NORMAL,
  'Low Priority': NEUTRAL,
  // Legacy values from before priority became free text.
  High: URGENT,
  Medium: NORMAL,
  Low: NEUTRAL,
};

/** Resolve pill colors for any priority string, defaulting to neutral. */
export function priorityMeta(priority: string): PriorityMeta {
  return META[priority] ?? NEUTRAL;
}
