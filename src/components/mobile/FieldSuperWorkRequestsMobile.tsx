import { Feather } from '@expo/vector-icons';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateWorkRequestSheet } from '@/components/mobile/CreateWorkRequestSheet';
import { MobileWorkRequestItem } from '@/components/mobile/MobileWorkRequestItem';
import { SegmentedControl } from '@/components/SegmentedControl';
import { jobsForFieldSuper, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { PRIORITY_CHOICES, PRIORITY_PRESETS, WorkRequest } from '@/types';
import { activeJobs } from '@/utils/jobArchive';
import { jobDisplayName } from '@/utils/jobName';
import { comparePriority } from '@/utils/priorityRange';
import {
  workRequestJobIds,
  workRequestJobsLabel,
  workRequestPoLabel,
} from '@/utils/workRequestJobs';

const SCHEDULE_FILTERS = ['All', 'Scheduled', 'Unscheduled'] as const;
type ScheduleFilter = (typeof SCHEDULE_FILTERS)[number];

// Priority filter chips: the range choices first, then the legacy presets,
// then anything custom alphabetically (same ordering idea as the web page).
const PRIORITY_ORDER: readonly string[] = [...PRIORITY_CHOICES, ...PRIORITY_PRESETS];

/** One FlatList row: a job header (group-by mode) or a work request. */
type Row =
  | { kind: 'header'; key: string; name: string; count: number }
  | { kind: 'card'; key: string; card: WorkRequest };

/**
 * The Field Super's work requests on the phone: every card on their jobs
 * (plus standalone ones), searchable and filterable by calendar status and
 * priority, optionally grouped by job, with the week's false-start count.
 * "New" opens the create sheet; tapping a card opens its details, where
 * Field Supers can also edit the office fields.
 */
export function FieldSuperWorkRequestsMobile() {
  const router = useRouter();
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const allWorkRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const [search, setSearch] = useState('');
  const [schedule, setSchedule] = useState<ScheduleFilter>('All');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [groupByJob, setGroupByJob] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Archived jobs (and with them their cards) stay out of the list.
  const myJobs = useMemo(
    () => (me ? activeJobs(jobsForFieldSuper(jobs, me.id)) : []),
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

  // In scope: cards linked to any of my jobs, plus standalone cards (no
  // parent job at all — they belong to no one's job list).
  const inScope = useMemo(
    () =>
      allWorkRequests.filter((card) => {
        const linked = workRequestJobIds(card);
        return linked.length === 0 || linked.some((id) => jobNameById.has(id));
      }),
    [allWorkRequests, jobNameById]
  );

  const unscheduledCount = useMemo(
    () => inScope.filter((c) => !scheduledIds.has(c.id)).length,
    [inScope, scheduledIds]
  );

  // False starts this week: cards installers set to 'False Start' whose
  // scheduled day (assignment date, else target date) falls in the current
  // Mon–Sun week — same read as the web page.
  const falseStartsThisWeek = useMemo(() => {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
    return inScope.filter((card) => {
      if (card.status !== 'False Start') return false;
      const dates = assignments
        .filter((a) => a.workRequestId === card.id)
        .map((a) => a.date);
      return dates.length > 0 ? dates.some(inWeek) : inWeek(card.date);
    }).length;
  }, [inScope, assignments]);

  // Distinct priorities present, in PRIORITY_ORDER then alphabetical.
  const priorities = useMemo(() => {
    const distinct = [...new Set(inScope.map((c) => c.priority).filter(Boolean))];
    return distinct.sort((a, b) => {
      const ia = PRIORITY_ORDER.indexOf(a);
      const ib = PRIORITY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [inScope]);

  const cards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inScope
      .filter((card) => {
        if (schedule === 'Scheduled' && !scheduledIds.has(card.id)) return false;
        if (schedule === 'Unscheduled' && scheduledIds.has(card.id)) return false;
        if (
          selectedPriorities.length > 0 &&
          !selectedPriorities.includes(card.priority)
        ) {
          return false;
        }
        if (!query) return true;
        const linked = workRequestJobIds(card);
        const jobName = workRequestJobsLabel(card, jobs);
        const jobPo = linked.map((id) => jobPoById.get(id) ?? '').join(' ');
        return (
          card.title.toLowerCase().includes(query) ||
          jobName.toLowerCase().includes(query) ||
          jobPo.toLowerCase().includes(query)
        );
      })
      .sort(comparePriority);
  }, [inScope, jobs, jobPoById, schedule, scheduledIds, search, selectedPriorities]);

  // Group the filtered cards by primary job (only when toggled on).
  const rows = useMemo<Row[]>(() => {
    if (!groupByJob) {
      return cards.map((card) => ({ kind: 'card', key: card.id, card }));
    }
    const byJob = new Map<string, WorkRequest[]>();
    for (const card of cards) {
      const key = card.jobId ?? '__none';
      const list = byJob.get(key);
      if (list) list.push(card);
      else byJob.set(key, [card]);
    }
    return [...byJob.entries()]
      .map(([key, list]) => ({
        key,
        name:
          key === '__none'
            ? 'No parent job'
            : (jobNameById.get(key) ?? workRequestJobsLabel(list[0], jobs) ?? 'Job'),
        list,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((group): Row[] => [
        { kind: 'header', key: `h-${group.key}`, name: group.name, count: group.list.length },
        ...group.list.map((card): Row => ({ kind: 'card', key: card.id, card })),
      ]);
  }, [cards, groupByJob, jobNameById, jobs]);

  const togglePriority = (p: string) =>
    setSelectedPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const filtersActive =
    !!search || schedule !== 'All' || selectedPriorities.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Work Requests</Text>
        <Pressable
          style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
          onPress={() => setCreateOpen(true)}
        >
          <Feather name="plus" size={15} color={colors.textOnAccent} />
          <Text style={styles.newButtonText}>New</Text>
        </Pressable>
      </View>
      <View style={styles.hintRow}>
        <Text style={styles.hint}>
          {inScope.length} {inScope.length === 1 ? 'work request' : 'work requests'} ·{' '}
          {unscheduledCount} not on calendar
        </Text>
        <View
          style={[
            styles.falseStartPill,
            falseStartsThisWeek > 0 && styles.falseStartPillHot,
          ]}
        >
          <Feather
            name="alert-circle"
            size={12}
            color={falseStartsThisWeek > 0 ? colors.danger : colors.textTertiary}
          />
          <Text
            style={[
              styles.falseStartText,
              falseStartsThisWeek > 0 && styles.falseStartTextHot,
            ]}
          >
            {falseStartsThisWeek} false start{falseStartsThisWeek === 1 ? '' : 's'} this week
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search work requests or jobs"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Feather name="x" size={15} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
        <SegmentedControl
          options={SCHEDULE_FILTERS}
          value={schedule}
          onChange={setSchedule}
        />
        {/* Group-by toggle + priority multi-select, one scrolling chip row. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            style={[styles.chip, groupByJob && styles.chipOn]}
            onPress={() => setGroupByJob((v) => !v)}
          >
            <Feather
              name="layers"
              size={13}
              color={groupByJob ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.chipText, groupByJob && styles.chipTextOn]}>
              Group by job
            </Text>
          </Pressable>
          {priorities.length > 0 && <View style={styles.chipDivider} />}
          {priorities.map((p) => {
            const active = selectedPriorities.includes(p);
            return (
              <Pressable
                key={p}
                style={[styles.chip, active && styles.chipOn]}
                onPress={() => togglePriority(p)}
              >
                <Feather
                  name={active ? 'check-square' : 'square'}
                  size={13}
                  color={active ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.chipText, active && styles.chipTextOn]}>{p}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View style={styles.groupHeader}>
              <Text style={styles.groupHeaderText} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.groupHeaderCount}>{item.count}</Text>
            </View>
          ) : (
            <MobileWorkRequestItem
              workRequest={item.card}
              jobName={workRequestPoLabel(item.card, jobs) || 'No parent job'}
              scheduled={scheduledIds.has(item.card.id)}
              onPress={() => router.push(`/work-request/${item.card.id}`)}
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="clipboard" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No work requests</Text>
            <Text style={styles.emptySubtitle}>
              {filtersActive
                ? 'Nothing matches the current filters.'
                : 'Work Requests on your jobs show up here — tap New to create one.'}
            </Text>
          </View>
        }
      />

      <CreateWorkRequestSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  newButtonText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  falseStartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  falseStartPillHot: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerDim,
  },
  falseStartText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  falseStartTextHot: {
    color: colors.danger,
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chipTextOn: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  chipDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  groupHeaderText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHeaderCount: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
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
