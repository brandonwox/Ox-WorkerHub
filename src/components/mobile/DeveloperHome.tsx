import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * Home tab for the base Developer identity on the phone. The Developer has no
 * console of its own — it always views the app *as* another role, so this just
 * points at the switcher in Settings.
 */
export function DeveloperHome() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Feather name="tool" size={22} color={colors.warning} />
        </View>
        <Text style={styles.title}>Developer mode</Text>
        <Text style={styles.body}>
          Open Settings and use “View as” to see the app as a specific worker
          and role.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warningDim,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.warningDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
  },
}));
