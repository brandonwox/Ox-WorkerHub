import { colors } from '@/theme';

/**
 * Distinct, dark-theme-friendly colors assigned to crews in order. Used to tint
 * scheduled work requests and the crew filter chips so every crew reads as its color.
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

/** The swatches offered by the Manage Crews color picker. */
export const CREW_COLOR_CHOICES = [
  ...CREW_PALETTE,
  '#5C6BC0', // indigo
  '#26A69A', // teal
  '#FF7043', // deep orange
  '#8D6E63', // brown
  '#78909C', // blue gray
  '#D4E157', // yellow-green
  '#BA68C8', // orchid
  '#F06292', // rose
];

/**
 * Build a stable crewId → color lookup: a crew's own picked `color` wins;
 * crews without one fall back to the palette by position in the (alphabetical)
 * crews list, so every crew reads consistently across the scheduler UI.
 */
export function buildCrewColorMap(
  crews: { id: string; color?: string }[]
): Map<string, string> {
  const map = new Map<string, string>();
  crews.forEach((crew, i) =>
    map.set(crew.id, crew.color ?? CREW_PALETTE[i % CREW_PALETTE.length])
  );
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
