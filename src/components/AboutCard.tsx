import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * "About this app" — the Settings card that answers "which code is this phone
 * running?": native app version + build number, and which OTA update (if
 * any) is loaded, with its publish time. On an installed build the
 * "Check for updates" button runs the full check → download → restart cycle
 * on the spot and prints the exact error if any step fails, so an update that
 * silently never lands can be diagnosed from the phone itself.
 *
 * Uses only modules already in the native build (expo-constants,
 * expo-updates) — this card ships as an OTA update itself and must not pull
 * in native code the 8/28 builds don't have.
 */
export function AboutCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    text: string;
    tone: 'info' | 'error';
  } | null>(null);

  const version =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '—';
  const build = Constants.nativeBuildVersion;
  const isWeb = Platform.OS === 'web';
  // Expo Go / dev client / web: no OTA runtime — nothing to check.
  const canCheck = !isWeb && Updates.isEnabled && !__DEV__;

  const updateLine = (() => {
    if (isWeb) return 'Web build';
    if (!Updates.isEnabled) return 'Updates off (development runtime)';
    if (Updates.isEmbeddedLaunch) return 'Built-in bundle · no update applied';
    const id = Updates.updateId ? Updates.updateId.slice(0, 8) : '?';
    const when = Updates.createdAt
      ? ` · published ${format(Updates.createdAt, 'MMM d, h:mm a')}`
      : '';
    return `Update ${id}${when}`;
  })();

  const check = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const found = await Updates.checkForUpdateAsync();
      if (!found.isAvailable) {
        setResult({ text: "You're up to date.", tone: 'info' });
        return;
      }
      setResult({ text: 'Update found — downloading…', tone: 'info' });
      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew) {
        setResult({
          text: 'Downloaded, but nothing new to apply.',
          tone: 'info',
        });
        return;
      }
      setResult({ text: 'Downloaded — restarting…', tone: 'info' });
      await Updates.reloadAsync();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setResult({ text: `Update failed: ${message}`, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="info" size={15} color={colors.textSecondary} />
        <Text style={styles.title}>About this app</Text>
      </View>

      <Text style={styles.line}>
        Version {version}
        {build ? ` (build ${build})` : ''}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        {updateLine}
      </Text>
      {!isWeb && Updates.channel ? (
        <Text style={styles.muted}>
          Channel {Updates.channel}
          {Updates.runtimeVersion ? ` · runtime ${Updates.runtimeVersion}` : ''}
        </Text>
      ) : null}
      {Updates.emergencyLaunchReason ? (
        <Text style={styles.error} numberOfLines={4}>
          Last update failed to launch: {Updates.emergencyLaunchReason}
        </Text>
      ) : null}

      {canCheck && (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || busy) && styles.buttonPressed,
          ]}
          onPress={check}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="refresh-cw" size={14} color={colors.primary} />
          )}
          <Text style={styles.buttonText}>
            {busy ? 'Checking…' : 'Check for updates'}
          </Text>
        </Pressable>
      )}

      {result ? (
        <Text
          style={result.tone === 'error' ? styles.error : styles.muted}
          selectable
        >
          {result.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    line: {
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    muted: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    buttonText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
  })
);
