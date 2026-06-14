import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

/** Shown when a worker reaches a desktop route their role can't access. */
export function AccessDenied() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Feather name="lock" size={24} color={colors.danger} />
      </View>
      <Text style={styles.title}>Access denied</Text>
      <Text style={styles.body}>
        Your role doesn't have permission to view this section.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.dangerDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
