import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormInput } from '@/components/FormInput';
import { markSelfActive, updatePassword } from '@/integrations/supabase';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/**
 * Where invited workers land after clicking their email invite link. The link
 * establishes a session but no password, so this screen lets them set one and
 * flips their account from `invited` to `active`. The layout role-gates redirect
 * a signed-in worker whose status is still `invited` here before anything else.
 */
export default function SetPasswordScreen() {
  const router = useRouter();
  const worker = useCurrentWorker();
  const setAuthWorker = useAppStore((s) => s.setAuthWorker);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!worker) return;
    if (password.length < 6) {
      setError('Choose a password of at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);

    const { error: updateError } = await updatePassword(password);
    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }

    // Persist the activation BEFORE navigating, and wait for it — otherwise the
    // invited-status gate bounces straight back here. Surface any failure rather
    // than leaving the account silently stuck as 'invited'.
    try {
      await markSelfActive(worker.id);
    } catch (e) {
      setBusy(false);
      setError(
        `Password saved, but activating your account failed: ${
          e instanceof Error ? e.message : 'unknown error'
        }`
      );
      return;
    }

    setAuthWorker({ ...worker, status: 'active' });
    setBusy(false);
    router.replace('/');
  };

  // Reached only with an active session; if there's no worker, bounce to login.
  if (!worker) return <Redirect href="/sign-in" />;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Set your password</Text>
        <Text style={styles.subtitle}>
          {worker.name
            ? `Welcome, ${worker.name}. `
            : ''}
          Choose a password to finish setting up your Ox WorkerHub account.
        </Text>

        <View style={styles.card}>
          <FormInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
          />
          <FormInput
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter your password"
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (busy || pressed) && styles.buttonDim,
            ]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.buttonText}>
              {busy ? 'Saving…' : 'Save and continue'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonDim: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
