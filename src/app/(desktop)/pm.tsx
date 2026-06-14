import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/**
 * Project Manager home. Placeholder this pass — PMs will create jobcards on a
 * parent Job (scope, priority, materials) for the Scheduler to assign.
 */
export default function PmScreen() {
  const role = useCurrentRole();
  if (role !== 'project_manager') return <AccessDenied />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.notice}>
        <View style={styles.iconWrap}>
          <Feather name="tool" size={22} color={colors.warning} />
        </View>
        <Text style={styles.badge}>Not functional yet</Text>
        <Text style={styles.title}>Jobcard creation coming soon</Text>
        <Text style={styles.body}>
          This is where the Project Manager will create jobcards against a parent
          Job — setting scope, priority, and materials — then release them to the
          Scheduler's backlog. Not wired up yet.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    maxWidth: 900,
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
});
