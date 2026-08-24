import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/FormInput';
import {
  NOTIFICATION_TYPE_LABELS,
  ROLE_NOTIFICATION_TYPES,
} from '@/components/notifications/NotificationList';
import { SegmentedControl } from '@/components/SegmentedControl';
import { updatePassword } from '@/integrations/supabase';
import { ROLE_LABELS } from '@/roles';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { initialsOf } from '@/utils/initials';
import { formatMoney } from '@/utils/time';

const THEME_OPTIONS = ['Dark', 'Light'] as const;

interface Props {
  /**
   * Tuck the personal details (hourly rate, email, phone, the profile form,
   * and Change Password) behind a "Personal information" row that opens a
   * full-screen sub-page, instead of showing them inline — the mobile
   * Settings tab. Desktop keeps the inline form.
   */
  personalInfoSubPage?: boolean;
}

/**
 * The worker's settings body — profile card, editable profile form, and the
 * appearance (theme) picker. Shared by the mobile Settings tab and the desktop
 * Settings page; the parent provides scroll/keyboard wrappers and layout gap.
 */
export function SettingsContent({ personalInfoSubPage = false }: Props) {
  const user = useCurrentWorker();
  // Password changes go through Supabase auth, so they need a real signed-in
  // session — the dev role switcher's local identities don't have one.
  const authWorker = useAppStore((s) => s.authWorker);
  const updateUser = useAppStore((s) => s.updateUser);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const mutedTypes = useAppStore((s) => s.mutedNotificationTypes);
  const toggleMuted = useAppStore((s) => s.toggleNotificationTypeMuted);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [personalOpen, setPersonalOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
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
    setError(null);
    updateUser({
      name: name.trim(),
      phone: phone.trim(),
    });
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  };

  // Gated by the layouts; null only during the sign-out transition.
  if (!user) return null;

  // The personal-details form — inline on desktop, inside the "Personal
  // information" sub-page on mobile (where it also carries the hourly rate
  // the profile card drops).
  const profileForm = (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Profile</Text>
      {personalInfoSubPage && user.role === 'installer' && (
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyLabel}>Hourly rate</Text>
          <Text style={styles.readonlyValue}>
            {formatMoney(user.hourlyRate)}/hr
          </Text>
        </View>
      )}
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
      {/* Email is the sign-in identity (Supabase auth) — not editable here,
          since changing only the profile row would break sign-in. */}
      <View style={styles.readonlyField}>
        <Text style={styles.readonlyLabel}>Email</Text>
        <Text style={styles.readonlyValue}>{user.email}</Text>
      </View>
      {/* Password changes live behind their own popup (they hit Supabase
          auth, not the profile row). Dev-switcher identities have no auth
          session to change. */}
      {authWorker ? (
        <Pressable
          style={({ pressed }) => [
            styles.changePasswordButton,
            pressed && styles.savePressed,
          ]}
          onPress={() => setPasswordOpen(true)}
        >
          <Feather name="lock" size={15} color={colors.textSecondary} />
          <Text style={styles.changePasswordText}>Change Password</Text>
        </Pressable>
      ) : (
        <Text style={styles.devPasswordHint}>
          Sign in with your account to change your password.
        </Text>
      )}

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
  );

  return (
    <>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileRole}>{ROLE_LABELS[user.role]}</Text>
          {/* The rate is personal info — behind the sub-page on mobile. */}
          {!personalInfoSubPage && user.role === 'installer' && (
            <Text style={styles.profileRate}>
              {formatMoney(user.hourlyRate)}/hr
            </Text>
          )}
        </View>
      </View>

      {/* Personal details: a sub-page behind this row on mobile, the inline
          form on desktop. */}
      {personalInfoSubPage ? (
        <Pressable
          style={({ pressed }) => [
            styles.personalInfoRow,
            pressed && styles.savePressed,
          ]}
          onPress={() => setPersonalOpen(true)}
        >
          <View style={styles.personalInfoIcon}>
            <Feather name="user" size={16} color={colors.primary} />
          </View>
          <Text style={styles.personalInfoText}>Personal information</Text>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.textTertiary}
          />
        </Pressable>
      ) : (
        profileForm
      )}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Appearance</Text>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={theme === 'dark' ? 'Dark' : 'Light'}
          onChange={(option) => setTheme(option === 'Dark' ? 'dark' : 'light')}
        />
      </View>

      {/* Per-type notification mutes — device-local; muted types still land
          on the bell, they just never toast/ping/vibrate. Only the types this
          role can actually receive are listed ("save failed" is unmutable). */}
      {ROLE_NOTIFICATION_TYPES[user.role].length > 0 && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Notifications</Text>
          <Text style={styles.notificationHint}>
            Turn a type off to stop its pop-up and sound on this device — it
            still appears on the notification bell.
          </Text>
          {ROLE_NOTIFICATION_TYPES[user.role].map((type) => {
            const muted = mutedTypes.includes(type);
            return (
              <Pressable
                key={type}
                style={({ pressed }) => [
                  styles.notificationRow,
                  pressed && styles.savePressed,
                ]}
                onPress={() => toggleMuted(type)}
              >
                <Feather
                  name={muted ? 'square' : 'check-square'}
                  size={18}
                  color={muted ? colors.textSecondary : colors.primary}
                />
                <Text style={styles.notificationRowText}>
                  {NOTIFICATION_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* The "Personal information" sub-page — a full-screen slide-in page
          with a back arrow (mobile only). The password popup renders inside
          it so it layers on top. */}
      {personalInfoSubPage ? (
        <Modal
          visible={personalOpen}
          animationType="slide"
          onRequestClose={() => setPersonalOpen(false)}
        >
          <SafeAreaView style={styles.subPageScreen} edges={['top']}>
            <KeyboardAvoidingView
              style={styles.subPageFlex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView contentContainerStyle={styles.subPageContent}>
                <View style={styles.subPageHeader}>
                  <Pressable
                    hitSlop={12}
                    onPress={() => setPersonalOpen(false)}
                    style={({ pressed }) => [pressed && styles.savePressed]}
                  >
                    <Feather
                      name="arrow-left"
                      size={24}
                      color={colors.textPrimary}
                    />
                  </Pressable>
                  <Text style={styles.subPageTitle}>Personal information</Text>
                </View>
                {profileForm}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
          <ChangePasswordModal
            visible={passwordOpen}
            onClose={() => setPasswordOpen(false)}
          />
        </Modal>
      ) : (
        <ChangePasswordModal
          visible={passwordOpen}
          onClose={() => setPasswordOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The Change Password popup: new password + confirmation, validated like the
 * set-password screen, then pushed to Supabase auth. (The old inline "New
 * password" field was silently discarded — this actually changes it.)
 */
function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const flash = useAppStore((s) => s.flash);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword('');
    setConfirm('');
    setError(null);
    setBusy(false);
    onClose();
  };

  const submit = async () => {
    if (busy) return;
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
    flash('Password changed', 'success');
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.formTitle}>Change Password</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <FormInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
          />
          <FormInput
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (busy || pressed) && styles.savePressed,
            ]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.saveText}>
              {busy ? 'Changing…' : 'Change Password'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    personalInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    personalInfoIcon: {
      width: 34,
      height: 34,
      borderRadius: radii.md,
      backgroundColor: colors.primaryDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    personalInfoText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 15,
    },
    subPageScreen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    subPageFlex: {
      flex: 1,
    },
    subPageContent: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    subPageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    subPageTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 20,
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
    readonlyField: {
      gap: spacing.xs,
    },
    readonlyLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    readonlyValue: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    changePasswordButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
    },
    changePasswordText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    devPasswordHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    notificationHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    notificationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    notificationRowText: {
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
