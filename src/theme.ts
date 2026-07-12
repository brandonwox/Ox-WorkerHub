/**
 * Theme system. The app ships two palettes (dark + light) with the same
 * semantic keys; the worker picks one in Settings (persisted per device).
 *
 * How live switching works:
 * - `colors` is a getter-backed object — every read resolves against the
 *   ACTIVE palette, so render-time reads are always current.
 * - Module-scope `StyleSheet.create` blocks would bake colors at import time,
 *   so they are wrapped in `themed(() => StyleSheet.create({...}))`: a lazy
 *   proxy that rebuilds the styles whenever the scheme has changed since the
 *   last read.
 * - The root layout remounts the app tree when the scheme changes (and
 *   restores the current route), so every mounted component re-reads both.
 */

export type ThemeScheme = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceLight: string;
  border: string;
  primary: string;
  primaryDim: string;
  danger: string;
  dangerDim: string;
  success: string;
  successDim: string;
  warning: string;
  warningDim: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Label color on solid accent fills (primary/danger buttons) — white in both themes. */
  textOnAccent: string;
  overlay: string;
}

const darkPalette: Palette = {
  background: '#1C1C1C',
  surface: '#262626',
  surfaceLight: '#303030',
  border: '#3A3A3A',
  primary: '#3E96F4',
  primaryDim: 'rgba(62, 150, 244, 0.16)',
  danger: '#f43e3e',
  dangerDim: 'rgba(244, 98, 62, 0.16)',
  success: '#4CC38A',
  successDim: 'rgba(76, 195, 138, 0.16)',
  warning: '#F2B33D',
  warningDim: 'rgba(242, 179, 61, 0.16)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A8A8A8',
  textTertiary: '#777777',
  textOnAccent: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

// Soft near-white UI: white cards on a #FEFEFE page separated by hairline
// borders, light-grey inset elements, black text with one neutral grey for
// icons/secondary copy, and the same brand blue as dark mode.
const lightPalette: Palette = {
  background: '#FEFEFE',
  surface: '#FFFFFF',
  surfaceLight: '#F1F2F4',
  border: '#E5E6EA',
  primary: '#3E96F4',
  primaryDim: 'rgba(62, 150, 244, 0.14)',
  danger: '#D6362F',
  dangerDim: 'rgba(214, 54, 47, 0.12)',
  success: '#1F9D63',
  successDim: 'rgba(31, 157, 99, 0.14)',
  warning: '#B4800E',
  warningDim: 'rgba(180, 128, 14, 0.16)',
  textPrimary: '#000000',
  textSecondary: '#6B6C71',
  textTertiary: '#9B9CA1',
  textOnAccent: '#FFFFFF',
  // Stays dark: overlays sit on photos/camera content, not on the page.
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const palettes: Record<ThemeScheme, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

let activeScheme: ThemeScheme = 'dark';
// Bumped on every scheme change; `themed()` caches rebuild when it moves.
let themeVersion = 0;

export function getThemeScheme(): ThemeScheme {
  return activeScheme;
}

/**
 * Swap the active palette. UI reactivity is the caller's job — the root
 * layout keys the app tree by scheme so everything remounts with new colors.
 */
export function setThemeScheme(scheme: ThemeScheme): void {
  if (scheme === activeScheme) return;
  activeScheme = scheme;
  themeVersion += 1;
}

/**
 * The active palette. Every property is a getter into the current scheme, so
 * reads at render time always match the selected theme. Do NOT read these into
 * module-scope constants — that bakes one scheme; wrap in `themed()` instead.
 */
export const colors = {} as Palette;
for (const key of Object.keys(darkPalette) as (keyof Palette)[]) {
  Object.defineProperty(colors, key, {
    enumerable: true,
    get: () => palettes[activeScheme][key],
  });
}

/**
 * Make a module-scope, color-derived object theme-aware: `create` runs lazily
 * and re-runs after every scheme change, so `themed(() => StyleSheet.create(…))`
 * (or a color lookup map) always reflects the active palette. Supports
 * property reads, `in`, spread, and Object.keys.
 */
export function themed<T extends object>(create: () => T): T {
  let cached: T | null = null;
  let cachedVersion = -1;
  const resolve = (): T => {
    if (!cached || cachedVersion !== themeVersion) {
      cached = create();
      cachedVersion = themeVersion;
    }
    return cached;
  };
  return new Proxy({} as T, {
    get: (_t, prop) => Reflect.get(resolve(), prop),
    has: (_t, prop) => Reflect.has(resolve(), prop),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_t, prop) => {
      const desc = Object.getOwnPropertyDescriptor(resolve(), prop);
      if (desc) desc.configurable = true;
      return desc;
    },
  });
}

/**
 * The dark palette as a fixed (non-switching) object. For media surfaces —
 * the camera, the full-screen photo viewers, badges over photo thumbnails —
 * whose chrome sits on viewfinder/photo content and must stay dark-styled in
 * both themes.
 */
export const darkColors: Palette = darkPalette;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
};

/**
 * Soft drop shadow for desktop popup modals — they float over the page without
 * darkening it (no dimmed overlay), so the shadow does the lifting. Lighter in
 * light mode, where a heavy shadow reads as a smudge.
 */
export const modalShadow = themed(() => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: getThemeScheme() === 'dark' ? 0.55 : 0.18,
  shadowRadius: 28,
  elevation: 16,
}));
