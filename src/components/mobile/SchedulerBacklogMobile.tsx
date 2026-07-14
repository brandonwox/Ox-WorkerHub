import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileJobcardItem } from '@/components/mobile/MobileJobcardItem';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';
import { Jobcard } from '@/types';
import { jobDisplayNameById } from '@/utils/jobName';
import { comparePriority } from '@/utils/priorityRange';

/**
 * The Scheduler's backlog on the phone: every jobcard not yet on the calendar,
 * most urgent first. Placing a card happens from the Calendar tab (pick a day,
 * then Assign on a crew).
 */
export function SchedulerBacklogMobile() {
  const router = useRouter();
  const jobcards = useAppStore((s) => s.jobcards);
  const jobs = useAppStore((s) => s.jobs);
  const assignments = useAppStore((s) => s.assignments);

  // Same rule as the desktop board: no assignment row anywhere = backlog.
  const backlog = useMemo(
    () =>
      jobcards
        .filter((c) => assignments.every((a) => a.jobcardId !== c.id))
        .sort(comparePriority),
    [jobcards, assignments]
  );

  const jobNameFor = (card: Jobcard) =>
    jobDisplayNameById(card.jobId, jobs) || 'Unlinked job';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Backlog</Text>
      <Text style={styles.hint}>
        {backlog.length} {backlog.length === 1 ? 'jobcard' : 'jobcards'} waiting ·
        assign from the Calendar tab
      </Text>

      <FlatList
        data={backlog}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MobileJobcardItem
            jobcard={item}
            jobName={jobNameFor(item)}
            onPress={() => router.push(`/job/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Backlog is clear</Text>
            <Text style={styles.emptySubtitle}>
              Every jobcard is on the calendar.
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
    gap: spacing.md,
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
