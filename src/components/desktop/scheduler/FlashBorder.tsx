import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { colors, radii } from '@/theme';

/**
 * "Look here" overlay for the calendar's show-in-calendar reveal: an accent
 * border over the chip that blinks, comes on once more, then slowly fades
 * back to normal. Runs once on mount — remount (key it by the reveal's
 * nonce) to replay.
 */
export function FlashBorder({ radius = radii.sm }: { radius?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const blink = (to: number) =>
      Animated.timing(anim, {
        toValue: to,
        duration: 320,
        // Animating opacity JS-side — react-native-web has no native driver.
        useNativeDriver: false,
      });
    const run = Animated.sequence([
      blink(1),
      blink(0),
      blink(1),
      Animated.timing(anim, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: false,
      }),
    ]);
    run.start();
    return () => run.stop();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderWidth: 2,
          borderRadius: radius,
          borderColor: colors.primary,
          opacity: anim,
        },
      ]}
    />
  );
}
