import { Feather } from '@expo/vector-icons';
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
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const enterDevMode = useAppStore((s) => s.enterDevMode);
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

  // Local development only: load the in-memory mock seed and enter the app as
  // the Developer. This block is compiled out of production builds (__DEV__ is
  // false), so it can never appear on the deployed website.
  const enterDev = () => {
    enterDevMode();
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Feather name="box" size={28} color={colors.primary} />
          </View>
          <Text style={styles.brandName}>Ox WorkerHub</Text>
          <Text style={styles.brandTagline}>
            Sign in with your worker account.
          </Text>
        </View>

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

          {router.canGoBack() ? (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        {__DEV__ ? (
          <Pressable
            style={({ pressed }) => [styles.devButton, pressed && styles.buttonDim]}
            onPress={enterDev}
          >
            <Feather name="tool" size={14} color={colors.warning} />
            <Text style={styles.devButtonText}>Enter dev mode (mock data)</Text>
          </Pressable>
        ) : null}
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
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  brandName: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 26,
  },
  brandTagline: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: 'center',
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
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warningDim,
    backgroundColor: colors.surface,
  },
  devButtonText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
});
