import { useRouter } from 'expo-router';
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
import { signIn } from '@/integrations/supabase';
import { colors, fonts, radii, spacing } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInError } = await signIn(email.trim(), password);
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // The session bootstrap resolves the worker; the role gates redirect from "/".
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Sign in to Ox WorkerHub</Text>
        <Text style={styles.subtitle}>
          Use the email and password for your worker account.
        </Text>

        <View style={styles.card}>
          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@ox-glass.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
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
              {busy ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
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
  cancel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: 'center',
  },
});
