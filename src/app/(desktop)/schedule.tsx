import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/**
 * Scheduler home. Placeholder this pass — the assignment board (drag jobcards
 * onto crew schedules) is awaiting further instructions.
 */
export default function ScheduleScreen() {
  const role = useCurrentRole();
  if (role !== 'scheduler') return <AccessDenied />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.notice}>
        <View style={styles.iconWrap}>
          <Feather name="tool" size={22} color={colors.warning} />
        </View>
        <Text style={styles.badge}>Not functional yet</Text>
        <Text style={styles.title}>Schedule board coming soon</Text>
        <Text style={styles.body}>
          This is where the Scheduler will assign jobcards to installer
          schedules. The interface is still being specced — no actions are wired
          up here yet.
        </Text>
      </View>

      <View style={styles.placeholderBoard}>
        {['Unassigned', 'Marcus Lee', 'Sofia Ramirez'].map((col) => (
          <View key={col} style={styles.column}>
            <Text style={styles.columnTitle}>{col}</Text>
            <View style={styles.ghostCard} />
            <View style={styles.ghostCard} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    maxWidth: 1100,
  },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warningDim,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.warningDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 560,
  },
  placeholderBoard: {
    flexDirection: 'row',
    gap: spacing.lg,
    opacity: 0.45,
  },
  column: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 220,
  },
  columnTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ghostCard: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
});
