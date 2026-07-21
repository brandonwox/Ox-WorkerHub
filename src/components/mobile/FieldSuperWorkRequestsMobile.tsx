import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileWorkRequestItem } from '@/components/mobile/MobileWorkRequestItem';
import { SegmentedControl } from '@/components/SegmentedControl';
import { jobsForFieldSuper, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { jobDisplayName } from '@/utils/jobName';
import { comparePriority } from '@/utils/priorityRange';
import {
  workRequestJobIds,
  workRequestJobsLabel,
} from '@/utils/workRequestJobs';

const SCHEDULE_FILTERS = ['All', 'Scheduled', 'Unscheduled'] as const;
type ScheduleFilter = (typeof SCHEDULE_FILTERS)[number];

/**
 * The Field Super's work requests on the phone: every card on their jobs, searchable
 * and filterable by calendar status. Creating and editing work requests stays on the
 * desktop console; tapping a card opens its details.
 */
export function FieldSuperWorkRequestsMobile() {
  const router = useRouter();
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const allWorkRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const [search, setSearch] = useState('');
  const [schedule, setSchedule] = useState<ScheduleFilter>('All');

  const myJobs = useMemo(
    () => (me ? jobsForFieldSuper(jobs, me.id) : []),
    [jobs, me]
  );

  // Sub-jobs display conjoined with their parent's name ("Vista Homes Lot 2").
  const jobNameById = useMemo(
    () => new Map(myJobs.map((job) => [job.id, jobDisplayName(job, jobs)])),
    [myJobs, jobs]
  );
  // Job POs match the search too (anywhere job names do).
  const jobPoById = useMemo(
    () => new Map(myJobs.map((job) => [job.id, job.po ?? ''])),
    [myJobs]
  );

  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.workRequestId)),
    [assignments]
  );

  const cards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allWorkRequests
      .filter((card) => {
        // In scope: cards linked to any of my jobs, plus standalone cards
        // (no parent job at all — they belong to no one's job list).
        const linked = workRequestJobIds(card);
        if (linked.length > 0 && !linked.some((id) => jobNameById.has(id))) {
          return false;
        }
        if (schedule === 'Scheduled' && !scheduledIds.has(card.id)) return false;
        if (schedule === 'Unscheduled' && scheduledIds.has(card.id)) return false;
        if (!query) return true;
        const jobName = workRequestJobsLabel(card, jobs);
        const jobPo = linked.map((id) => jobPoById.get(id) ?? '').join(' ');
        return (
          card.title.toLowerCase().includes(query) ||
          jobName.toLowerCase().includes(query) ||
          jobPo.toLowerCase().includes(query)
        );
      })
      .sort(comparePriority);
  }, [allWorkRequests, jobs, jobNameById, jobPoById, schedule, scheduledIds, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Work Requests</Text>
      <Text style={styles.hint}>
        {cards.length} {cards.length === 1 ? 'work request' : 'work requests'} · create and
        edit from the desktop console
      </Text>

      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search work requests"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <SegmentedControl
          options={SCHEDULE_FILTERS}
          value={schedule}
          onChange={setSchedule}
        />
      </View>

      <FlatList
        data={cards}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <MobileWorkRequestItem
            workRequest={item}
            jobName={workRequestJobsLabel(item, jobs) || 'No parent job'}
            scheduled={scheduledIds.has(item.id)}
            onPress={() => router.push(`/work-request/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="clipboard" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No work requests</Text>
            <Text style={styles.emptySubtitle}>
              {search || schedule !== 'All'
                ? 'Nothing matches the current filters.'
                : 'Work Requests on your jobs show up here.'}
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
  },
  controls: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    paddingVertical: spacing.md,
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
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
}));
