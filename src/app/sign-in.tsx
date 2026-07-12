import { AntDesign, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { signIn, signInWithGoogle } from '@/integrations/supabase';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const enterDevMode = useAppStore((s) => s.enterDevMode);
  const authWorker = useAppStore((s) => s.authWorker);
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
    if (signInError) {
      setBusy(false);
      setError(signInError.message);
      return;
    }
    // Leave navigation to the reactive redirect below: the auth listener sets
    // authWorker a moment from now, which flips this screen to "/". Keep `busy`
    // true so the button stays disabled through that brief gap.
  };

  const submitGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setBusy(false);
      setError(googleError.message);
      return;
    }
    // On web this navigates away to Google; on native the auth listener flips
    // authWorker once the callback lands. Release the button anyway so a
    // cancelled native flow (which resolves with no error and no session)
    // doesn't leave the form stuck disabled.
    setBusy(false);
  };

  // Local development only: load the in-memory mock seed and enter the app as
  // the Developer. This block is compiled out of production builds (__DEV__ is
  // false), so it can never appear on the deployed website.
  const enterDev = () => {
    enterDevMode();
    router.replace('/');
  };

  // A real session has resolved (set asynchronously by the auth listener after
  // signIn). Leave the login screen; the role gates at "/" route to the correct
  // home, or to set-password for invited workers. Gating on authWorker (not the
  // effective worker) keeps the form usable in dev mode and for account switches.
  if (authWorker) return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/images/ox-logo.png')}
            style={styles.logoMark}
            contentFit="contain"
          />
          <Text style={styles.brandName}>WorkerHub</Text>
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
            onSubmitEditing={submit}
          />
          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={submit}
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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              (busy || pressed) && styles.buttonDim,
            ]}
            onPress={submitGoogle}
            disabled={busy}
          >
            <AntDesign name="google" size={16} color={colors.textPrimary} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
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

const styles = themed(() => StyleSheet.create({
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
    width: 72,
    height: 72,
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
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
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
}));
