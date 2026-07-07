import { colors } from '@/theme';

/**
 * Distinct, dark-theme-friendly colors assigned to crews in order. Used to tint
 * scheduled jobcards and the crew filter chips so every crew reads as its color.
 */
export const CREW_PALETTE = [
  '#3E96F4', // blue
  '#4CC38A', // green
  '#F2B33D', // amber
  '#F47C6A', // coral
  '#A97BF0', // purple
  '#3DD6D6', // cyan
  '#EC79C0', // pink
  '#8FD14F', // lime
];

/**
 * Build a stable crewId → color lookup keyed by position in the crews list, so
 * each crew gets a distinct, consistent color across the scheduler UI.
 */
export function buildCrewColorMap(crewIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  crewIds.forEach((id, i) => map.set(id, CREW_PALETTE[i % CREW_PALETTE.length]));
  return map;
}

/** Color for a crew id, falling back to neutral grey for unknown ids. */
export function crewColorFrom(
  map: Map<string, string>,
  crewId: string
): string {
  return map.get(crewId) ?? colors.textTertiary;
}

/**
 * Append an alpha byte to a `#RRGGBB` hex color. React Native accepts the
 * resulting `#RRGGBBAA` form. `alpha` is clamped to 0–1.
 */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
