import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/integrations/supabase';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

interface Props {
  /** 'card' for the mobile Settings screen, 'bar' for the desktop top bar. */
  variant?: 'card' | 'bar';
}

/**
 * Sign in / sign out control. When signed in (a real Supabase worker), shows the
 * account + a sign-out button; otherwise a "Sign in" button. In dev mode (the
 * Developer base identity) this is how you switch into a real account.
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
    return (
      <Pressable
        style={({ pressed }) => [
          isBar ? styles.bar : styles.card,
          pressed && styles.pressed,
        ]}
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

const styles = StyleSheet.create({
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
});
