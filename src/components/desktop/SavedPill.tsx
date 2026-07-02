import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

// react-native-web has no native animation module; opt out there to avoid the
// "useNativeDriver is not supported" warning (matches NotificationToaster).
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// How long the pill lingers before it fades back out.
const VISIBLE_MS = 2000;

/**
 * A small "Changes Saved" pill that flashes at the bottom of the desktop
 * sidebar whenever a backend write succeeds. It watches the store's `savedTick`
 * (bumped once per successful Supabase write) and, on each new tick, fades in,
 * holds briefly, then fades out. Because `savedTick` only advances for real DB
 * writes, this never fires in local dev mode or for the Developer.
 */
export function SavedPill() {
  const savedTick = useAppStore((s) => s.savedTick);
  const [opacity] = useState(() => new Animated.Value(0));
  // Skip the initial render: the pill should only appear on an actual save, not
  // on first mount (savedTick starts at 0).
  const seenTick = useRef(savedTick);

  useEffect(() => {
    if (savedTick === seenTick.current) return;
    seenTick.current = savedTick;

    opacity.stopAnimation();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [savedTick, opacity]);

  return (
    <Animated.View style={[styles.pill, { opacity }]} pointerEvents="none">
      <Feather name="check" size={14} color={colors.success} />
      <Text style={styles.text}>Changes Saved</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successDim,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
