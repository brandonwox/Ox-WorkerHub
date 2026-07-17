import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/integrations/supabase';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { initialsOf } from '@/utils/initials';

interface Props {
  /** 'card' for the mobile Settings screen, 'bar' for the desktop top bar. */
  variant?: 'card' | 'bar';
}

/**
 * Account control. Signed in, the desktop top bar ('bar') shows a profile chip
 * — initials avatar + name — that opens the Settings page (sign-out lives at
 * the bottom of that page); the 'card' variant IS that sign-out button (mobile
 * Settings + the bottom of web Settings). Signed out, both show "Sign in" —
 * in dev mode (the Developer base identity) that's how you switch into a real
 * account.
 */
export function AuthControl({ variant = 'card' }: Props) {
  const router = useRouter();
  const authWorker = useAppStore((s) => s.authWorker);
  const setAuthWorker = useAppStore((s) => s.setAuthWorker);

  const handleSignOut = async () => {
    await signOut();
    setAuthWorker(null);
  };

  const isBar = variant === 'bar';

  if (authWorker) {
    if (isBar) {
      return (
        <Pressable
          style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
          onPress={() => router.push('/console-settings')}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(authWorker.name)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {authWorker.name}
          </Text>
        </Pressable>
      );
    }
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={handleSignOut}
      >
        <Feather name="log-out" size={15} color={colors.textSecondary} />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {authWorker.name}
          </Text>
          <Text style={styles.action}>Sign out</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        isBar ? styles.bar : styles.card,
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/sign-in')}
    >
      <Feather name="log-in" size={15} color={colors.primary} />
      <Text style={styles.signInText}>Sign in</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryDim,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  text: {
    flexShrink: 1,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  action: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  signInText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
}));
