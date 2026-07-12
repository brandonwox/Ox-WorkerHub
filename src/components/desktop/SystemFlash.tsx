import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';

import { FlashTone, useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

// react-native-web has no native animation module; opt out there to avoid the
// "useNativeDriver is not supported" warning (matches NotificationToaster).
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// How long the pill lingers before it fades back out.
const VISIBLE_MS = 2600;

// Per-tone icon + accent color. Every system message routes through here, so a
// single mapping keeps "Changes Saved", assignment confirmations, and validation
// nudges visually consistent in the sidebar footer.
const TONE: Record<
  FlashTone,
  { icon: keyof typeof Feather.glyphMap; color: string; dim: string }
> = themed(() => ({
  success: { icon: 'check', color: colors.success, dim: colors.successDim },
  info: { icon: 'info', color: colors.primary, dim: colors.primaryDim },
  warning: {
    icon: 'alert-triangle',
    color: colors.warning,
    dim: colors.warningDim,
  },
}));

/**
 * The single system-message pill for the desktop consoles. It sits pinned to the
 * bottom of the left sidebar and watches the store's `flashTick` (bumped by every
 * `flash()` / successful save). On each new tick it fades in the current message,
 * holds briefly, then fades out — so all transient toasts land in one consistent
 * spot instead of rendering behind the calendar or other content.
 */
export function SystemFlash() {
  const flashTick = useAppStore((s) => s.flashTick);
  const flashMessage = useAppStore((s) => s.flashMessage);
  const flashTone = useAppStore((s) => s.flashTone);
  const [opacity] = useState(() => new Animated.Value(0));
  // Skip the initial render: the pill should only appear on an actual flash, not
  // on first mount (flashTick starts at 0).
  const seenTick = useRef(flashTick);

  useEffect(() => {
    if (flashTick === seenTick.current) return;
    seenTick.current = flashTick;

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
  }, [flashTick, opacity]);

  if (!flashMessage) return null;
  const tone = TONE[flashTone] ?? TONE.info;

  return (
    <Animated.View
      style={[
        styles.pill,
        { backgroundColor: tone.dim, borderColor: tone.color, opacity },
      ]}
      pointerEvents="none"
    >
      <Feather name={tone.icon} size={14} color={tone.color} />
      <Text style={[styles.text, { color: tone.color }]} numberOfLines={2}>
        {flashMessage}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
