import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Drives a looping 0 → 1 → 0 value for slow "breathing" effects such as the
 * animated border on the job card the worker is clocked into. Runs only while
 * `active` is true. Color interpolation requires the JS driver, so the consumer
 * must keep `useNativeDriver: false` on any style it applies this to.
 */
export function usePulse(active = true): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);

  return value;
}
