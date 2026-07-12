import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { formatMoney } from '@/utils/time';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

const THEME_OPTIONS = ['Dark', 'Light'] as const;

/**
 * The worker's settings body — profile card, editable profile form, and the
 * appearance (theme) picker. Shared by the mobile Settings tab and the desktop
 * Settings page; the parent provides scroll/keyboard wrappers and layout gap.
 */
export function SettingsContent() {
  const user = useCurrentWorker();
  const updateUser = useAppStore((s) => s.updateUser);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const save = () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    updateUser({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    setPassword('');
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  };

  // Gated by the layouts; null only during the sign-out transition.
  if (!user) return null;

  return (
    <>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileRole}>
            {user.installerType ?? user.tradeRole}
          </Text>
          <Text style={styles.profileRate}>
            {formatMoney(user.hourlyRate)}/hr
          </Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Profile</Text>
        <FormInput
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
        />
        <FormInput
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 000-0000"
          keyboardType="phone-pad"
        />
        <FormInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormInput
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="Leave blank to keep current"
          secureTextEntry
          autoCapitalize="none"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.savePressed,
          ]}
          onPress={save}
        >
          <Text style={styles.saveText}>
            {saved ? 'Saved ✓' : 'Save Changes'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Appearance</Text>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={theme === 'dark' ? 'Dark' : 'Light'}
          onChange={(option) => setTheme(option === 'Dark' ? 'dark' : 'light')}
        />
      </View>
    </>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryDim,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 22,
    },
    profileInfo: {
      flex: 1,
      gap: 2,
    },
    profileName: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    profileRole: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    profileRate: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.lg,
    },
    formTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 16,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    savePressed: {
      opacity: 0.85,
    },
    saveText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 16,
    },
  })
);
