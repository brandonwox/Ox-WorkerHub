import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_LABELS } from '@/roles';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { AppRole, Worker } from '@/types';
import { formatMoney } from '@/utils/time';

const SECTION_ORDER: AppRole[] = ['operator', 'field_super', 'scheduler', 'installer'];

/**
 * The Operator's roster on the phone: workers grouped by role, with rate and
 * installer type where relevant. Inviting, role changes, and rate edits stay
 * on the desktop console.
 */
export function OperatorPeopleMobile() {
  const workers = useAppStore((s) => s.workers);

  const sections = useMemo(
    () =>
      SECTION_ORDER.map((role) => ({
        title: ROLE_LABELS[role],
        data: workers
          .filter((w) => w.role === role)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((section) => section.data.length > 0),
    [workers]
  );

  const renderWorker = (worker: Worker) => (
    <View style={styles.row}>
      <View style={styles.main}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {worker.name}
          </Text>
          {worker.status === 'invited' && (
            <View style={styles.invitedPill}>
              <Text style={styles.invitedText}>Invited</Text>
            </View>
          )}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {worker.email}
        </Text>
      </View>
      {worker.role === 'installer' && (
        <View style={styles.right}>
          <Text style={styles.rate}>{formatMoney(worker.hourlyRate)}/hr</Text>
          {worker.installerType ? (
            <Text style={styles.type} numberOfLines={1}>
              {worker.installerType}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>People</Text>
      <Text style={styles.hint}>
        {workers.length} {workers.length === 1 ? 'worker' : 'workers'} · invite
        and manage from the desktop console
      </Text>

      <SectionList
        sections={sections}
        keyExtractor={(worker) => worker.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => renderWorker(item)}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No workers yet</Text>
            <Text style={styles.emptySubtitle}>
              Invite workers from the desktop console.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    flexShrink: 1,
  },
  invitedPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.warningDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  invitedText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: 140,
  },
  rate: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  type: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
}));
