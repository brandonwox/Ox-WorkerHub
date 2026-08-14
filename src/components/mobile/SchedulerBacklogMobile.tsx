import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isReadyNow } from '@/components/desktop/scheduler/Backlog';
import { MobileWorkRequestItem } from '@/components/mobile/MobileWorkRequestItem';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';
import { WorkRequest } from '@/types';
import { activeWorkRequests } from '@/utils/jobArchive';
import { workRequestJobsLabel } from '@/utils/workRequestJobs';
import { comparePriority } from '@/utils/priorityRange';

/**
 * The Scheduler's backlog on the phone: every work request not yet on the calendar,
 * most urgent first. Placing a card happens from the Calendar tab (pick a day,
 * then Assign on a crew).
 */
export function SchedulerBacklogMobile() {
  const router = useRouter();
  const workRequests = useAppStore((s) => s.workRequests);
  const jobs = useAppStore((s) => s.jobs);
  const assignments = useAppStore((s) => s.assignments);

  // Same rule as the desktop board: no assignment row anywhere = backlog.
  // (Archived jobs' cards are excluded, like everywhere active.)
  const unassigned = useMemo(
    () =>
      activeWorkRequests(workRequests, jobs)
        .filter((c) => assignments.every((a) => a.workRequestId !== c.id))
        .sort(comparePriority),
    [workRequests, jobs, assignments]
  );
  // Only requests marked ready ("Yes") sit in the schedulable pool; the rest
  // wait in the "Not ready yet" section so schedulers can see what's coming.
  const backlog = useMemo(() => unassigned.filter(isReadyNow), [unassigned]);
  const notReady = useMemo(
    () => unassigned.filter((c) => !isReadyNow(c)),
    [unassigned]
  );

  const jobNameFor = (card: WorkRequest) =>
    workRequestJobsLabel(card, jobs) || 'No parent job';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Backlog</Text>
      <Text style={styles.hint}>
        {backlog.length} {backlog.length === 1 ? 'work request' : 'work requests'} waiting ·
        assign from the Calendar tab
      </Text>

      <FlatList
        data={backlog}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MobileWorkRequestItem
            workRequest={item}
            jobName={jobNameFor(item)}
            onPress={() => router.push(`/work-request/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Backlog is clear</Text>
            <Text style={styles.emptySubtitle}>
              Every ready work request is on the calendar.
            </Text>
          </View>
        }
        ListFooterComponent={
          notReady.length > 0 ? (
            <View style={styles.notReadySection}>
              <Text style={styles.notReadyHeader}>
                Not ready yet ({notReady.length})
              </Text>
              {notReady.map((item) => (
                <MobileWorkRequestItem
                  key={item.id}
                  workRequest={item}
                  jobName={jobNameFor(item)}
                  onPress={() => router.push(`/work-request/${item.id}`)}
                />
              ))}
            </View>
          ) : null
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
  notReadySection: {
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  notReadyHeader: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
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
