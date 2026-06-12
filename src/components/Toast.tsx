import { CircleCheck } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

interface Props {
  message: string | null;
  onDone: () => void;
}

/** Transient confirmation banner shown above the clock controls. */
export function Toast({ message, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 3200);
    return () => clearTimeout(timer);
  }, [message, opacity, onDone]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <CircleCheck size={18} color={colors.success} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 92,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
  },
  text: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
