import { useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

/**
 * Zoom-factor → expo-camera prop mapping. The `zoom` prop is normalized 0..1
 * over the device's max zoom, which is NOT exposed to JS, so the factors here
 * are nominal:
 *  - iOS applies it exponentially (videoZoomFactor = max^zoom); a typical wide
 *    lens max is ~16x, so factors are computed against that.
 *  - Android applies it linearly against CameraX's maxZoomRatio (~8x typical).
 * Sub-1x on iOS switches to the ultra-wide lens (0.5x) when the device has one.
 */
const IOS_ASSUMED_MAX = 16;
const ANDROID_ASSUMED_MAX = 8;

/** The `selectedLens` value for the 0.5x lens (iOS localized device name). */
export const ULTRA_WIDE_LENS = 'Back Ultra Wide Camera';

/** Hard ceiling of the zoom UI. */
export const MAX_ZOOM_FACTOR = 5;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** CameraView props (zoom + iOS lens) for a nominal zoom factor. */
export function cameraPropsForFactor(
  factor: number,
  hasUltraWide: boolean
): { zoom: number; selectedLens?: string } {
  if (Platform.OS === 'ios') {
    const useUltraWide = hasUltraWide && factor < 1;
    // Zoom is applied on top of the active lens, so sub-1x factors are
    // expressed relative to the ultra-wide's 0.5x base.
    const base = useUltraWide ? 0.5 : 1;
    const relative = Math.max(1, factor / base);
    return {
      zoom: clamp(Math.log(relative) / Math.log(IOS_ASSUMED_MAX), 0, 1),
      selectedLens: useUltraWide ? ULTRA_WIDE_LENS : undefined,
    };
  }
  return { zoom: clamp(factor / ANDROID_ASSUMED_MAX, 0, 1) };
}

const formatFactor = (f: number) => {
  const rounded = Math.round(f * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}×`;
};

interface Props {
  factor: number;
  /** Most zoomed-out factor the device supports (0.5 with ultra-wide, else 1). */
  minFactor: number;
  onChange: (factor: number) => void;
}

/**
 * iOS-camera-style zoom pills: tap a preset (0.5 / 1 / 1.5 / 3) to jump to it,
 * or grab the row and drag horizontally to scrub continuously between the
 * device's widest view and 5x.
 */
export function CameraZoomControl({ factor, minFactor, onChange }: Props) {
  const stops =
    minFactor < 1 ? [minFactor, 1, 1.5, 3] : [1, 1.5, 3];
  const [dragging, setDragging] = useState(false);

  // The responder is created once — read the latest factor/min through refs.
  const factorRef = useRef(factor);
  factorRef.current = factor;
  const minRef = useRef(minFactor);
  minRef.current = minFactor;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const dragStart = useRef(1);

  const responder = useRef(
    PanResponder.create({
      // Let plain taps through to the stop buttons; claim real drags.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        dragStart.current = factorRef.current;
        setDragging(true);
      },
      onPanResponderMove: (_, g) => {
        // Exponential feel: every ~140px of drag doubles/halves the factor.
        const next = clamp(
          dragStart.current * Math.pow(2, g.dx / 140),
          minRef.current,
          MAX_ZOOM_FACTOR
        );
        onChangeRef.current(Math.round(next * 20) / 20);
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  // The stop the current factor "belongs" to (nearest preset) — it renders
  // enlarged and shows the live factor instead of its own label.
  const activeStop = stops.reduce((best, s) =>
    Math.abs(s - factor) < Math.abs(best - factor) ? s : best
  );

  return (
    <View style={styles.row} {...responder.panHandlers}>
      {stops.map((stop) => {
        const active = stop === activeStop;
        return (
          <Pressable
            key={stop}
            style={[styles.stop, active && styles.stopActive]}
            onPress={() => onChange(stop)}
            hitSlop={4}
          >
            <Text style={[styles.stopText, active && styles.stopTextActive]}>
              {active ? formatFactor(factor) : formatFactor(stop).replace('×', '')}
            </Text>
          </Pressable>
        );
      })}
      {dragging && (
        <View style={styles.dragBadge}>
          <Text style={styles.dragBadgeText}>{formatFactor(factor)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stop: {
    minWidth: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  stopActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  stopText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  stopTextActive: {
    color: colors.warning,
    fontSize: 13,
  },
  dragBadge: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragBadgeText: {
    color: colors.warning,
    fontFamily: fonts.bold,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 4,
  },
});
