import { Feather } from '@expo/vector-icons';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CreateJobcardModal,
  NewJobcardInput,
} from '@/components/desktop/CreateJobcardModal';
import { JobcardQuickView } from '@/components/desktop/JobcardQuickView';
import {
  JobcardFilters,
  ScheduleFilter,
} from '@/components/desktop/JobcardFilters';
import { JobcardRow } from '@/components/desktop/JobcardRow';
import { JobPhotosModal } from '@/components/desktop/JobPhotosModal';
import { useAppStore, uuid } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job, PRIORITY_PRESETS } from '@/types';
import { jobDisplayName } from '@/utils/jobName';

const PRESET_ORDER = PRIORITY_PRESETS as readonly string[];

interface JobcardsScreenProps {
  /**
   * The jobs this viewer may work within — the route decides the scope (a
   * Field Super sees only their own jobs, the Scheduler sees every job) and
   * the screen shows just the jobcards hanging off them.
   */
  jobs: Job[];
  /** Show the false-starts-this-week counter (the Field Super's page). */
  showFalseStarts?: boolean;
  /**
   * Jump to the viewer's calendar with `date` highlighted. When set, hovering
   * a scheduled row's date turns it into a "View on calendar" link.
   */
  onViewCalendar?: (date: string) => void;
}

/** Desktop jobcards workspace: every jobcard in scope, its calendar status, and creation. */
export function JobcardsScreen({
  jobs,
  showFalseStarts = false,
  onViewCalendar,
}: JobcardsScreenProps) {
  const allJobcards = useAppStore((s) => s.jobcards);
  const assignments = useAppStore((s) => s.assignments);
  const addJobcard = useAppStore((s) => s.addJobcard);
  const deleteJobcard = useAppStore((s) => s.deleteJobcard);
  const flash = useAppStore((s) => s.flash);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [photosJob, setPhotosJob] = useState<Job | null>(null);

  // Filters / sort (all stack).
  const [search, setSearch] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleFilter>('all');
  const [groupByJob, setGroupByJob] = useState(false);

  const myJobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  const jobcards = useMemo(
    () => allJobcards.filter((c) => c.jobId != null && myJobIds.has(c.jobId)),
    [allJobcards, myJobIds]
  );

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'Active'),
    [jobs]
  );

  // "On the calendar" = the jobcard has a row in `assignments` (Scheduler placed it).
  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.jobcardId)),
    [assignments]
  );
  const unscheduledCount = useMemo(
    () => jobcards.filter((c) => !scheduledIds.has(c.id)).length,
    [jobcards, scheduledIds]
  );

  // The day each scheduled card shows in its status pill: its next upcoming
  // assignment date, or the most recent one when they're all in the past.
  const scheduledDateById = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const map = new Map<string, string>();
    const byCard = new Map<string, string[]>();
    for (const a of assignments) {
      const dates = byCard.get(a.jobcardId) ?? [];
      dates.push(a.date);
      byCard.set(a.jobcardId, dates);
    }
    for (const [cardId, dates] of byCard) {
      dates.sort();
      map.set(cardId, dates.find((d) => d >= today) ?? dates[dates.length - 1]);
    }
    return map;
  }, [assignments]);

  // False starts this week: cards installers set to 'False Start' whose
  // scheduled day (assignment date, else target date) falls in the current
  // Mon–Sun week — the closest read without a marked-at timestamp.
  const falseStartsThisWeek = useMemo(() => {
    if (!showFalseStarts) return 0;
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
    return jobcards.filter((card) => {
      if (card.status !== 'False Start') return false;
      const dates = assignments
        .filter((a) => a.jobcardId === card.id)
        .map((a) => a.date);
      return dates.length > 0 ? dates.some(inWeek) : inWeek(card.date);
    }).length;
  }, [showFalseStarts, jobcards, assignments]);

  // Sub-jobs display conjoined with their parent's name ("Vista Homes Lot 2").
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => map.set(j.id, jobDisplayName(j, jobs)));
    return map;
  }, [jobs]);
  const jobNameFor = (jobId?: string) =>
    (jobId && nameById.get(jobId)) || 'Unlinked job';

  // Distinct priorities present, ordered presets-first then alphabetical.
  const priorities = useMemo(() => {
    const distinct = [...new Set(jobcards.map((c) => c.priority))];
    return distinct.sort((a, b) => {
      const ia = PRESET_ORDER.indexOf(a);
      const ib = PRESET_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [jobcards]);

  // Apply search + priority + schedule filters (stacking).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobcards.filter((card) => {
      if (q) {
        const hay = `${card.title} ${jobNameFor(card.jobId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (
        selectedPriorities.length > 0 &&
        !selectedPriorities.includes(card.priority)
      ) {
        return false;
      }
      if (schedule === 'scheduled' && !scheduledIds.has(card.id)) return false;
      if (schedule === 'unscheduled' && scheduledIds.has(card.id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobcards, search, selectedPriorities, schedule, scheduledIds, nameById]);

  // Group the filtered cards by parent job (only when toggled on).
  const groups = useMemo(() => {
    if (!groupByJob) return null;
    const byJob = new Map<string, typeof filtered>();
    for (const card of filtered) {
      const key = card.jobId ?? '__none';
      const list = byJob.get(key);
      if (list) list.push(card);
      else byJob.set(key, [card]);
    }
    return [...byJob.entries()]
      .map(([key, cards]) => ({
        key,
        name: jobNameFor(key === '__none' ? undefined : key),
        cards,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupByJob, filtered, nameById]);

  const togglePriority = (p: string) =>
    setSelectedPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  const handleCreate = (input: NewJobcardInput) => {
    const parent = jobs.find((j) => j.id === input.jobId);
    addJobcard({
      jobId: input.jobId,
      title: input.title,
      address: parent?.location ?? '',
      // No calendar date at creation — the Scheduler places it later.
      date: format(new Date(), 'yyyy-MM-dd'),
      priority: input.priority,
      priorityStartDate: input.priorityStartDate || undefined,
      priorityEndDate: input.priorityEndDate || undefined,
      scopes: input.scopes,
      // The modal authors task text; each becomes a check-off item with a
      // stable id (installers tick them off from their phones).
      tasks: input.tasks.map((text) => ({ id: uuid(), text, done: false })),
      readiness: input.readiness,
      materials: input.materials,
      flashingMaterial: input.flashingMaterial,
      pickupRequired: input.pickupRequired,
      pickupLocation: input.pickupLocation,
      notes: input.notes,
      details: { generalContractor: '', managerName: '', managerPhone: '' },
    });
    flash(`Jobcard "${input.title}" created`, 'success');
  };

  const handleDelete = (id: string) => {
    const title = allJobcards.find((c) => c.id === id)?.title;
    deleteJobcard(id);
    flash(title ? `Jobcard "${title}" deleted` : 'Jobcard deleted', 'success');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>
            {jobcards.length} {jobcards.length === 1 ? 'jobcard' : 'jobcards'} ·{' '}
            {unscheduledCount} not on calendar
          </Text>
          {showFalseStarts && (
            <View
              style={[
                styles.falseStartPill,
                falseStartsThisWeek > 0 && styles.falseStartPillHot,
              ]}
            >
              <Feather
                name="alert-octagon"
                size={13}
                color={
                  falseStartsThisWeek > 0 ? colors.danger : colors.textTertiary
                }
              />
              <Text
                style={[
                  styles.falseStartText,
                  falseStartsThisWeek > 0 && styles.falseStartTextHot,
                ]}
              >
                {falseStartsThisWeek} false start
                {falseStartsThisWeek === 1 ? '' : 's'} this week
              </Text>
            </View>
          )}
        </View>

        {/* Single-row toolbar: filters (when there are cards) + Create button. */}
        <View style={styles.toolbar}>
          {jobcards.length > 0 ? (
            <JobcardFilters
              search={search}
              onSearch={setSearch}
              priorities={priorities}
              selectedPriorities={selectedPriorities}
              onTogglePriority={togglePriority}
              schedule={schedule}
              onSchedule={setSchedule}
              groupByJob={groupByJob}
              onToggleGroup={() => setGroupByJob((v) => !v)}
            />
          ) : (
            <View style={styles.toolbarSpacer} />
          )}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              activeJobs.length === 0 && styles.addButtonDisabled,
              pressed && activeJobs.length > 0 && styles.pressed,
            ]}
            onPress={() => setCreateOpen(true)}
            disabled={activeJobs.length === 0}
          >
            <Feather name="plus" size={16} color={colors.textOnAccent} />
            <Text style={styles.addButtonText}>Create jobcard</Text>
          </Pressable>
        </View>

        {jobcards.length === 0 ? (
          <Text style={styles.emptyText}>No jobcards yet.</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No jobcards match these filters.</Text>
        ) : groups ? (
          <View style={styles.groupStack}>
            {groups.map((group) => {
              const groupJob =
                group.key === '__none'
                  ? undefined
                  : jobs.find((j) => j.id === group.key);
              return (
              <View key={group.key} style={styles.group}>
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupHeader}>
                    {group.name}{' '}
                    <Text style={styles.groupCount}>· {group.cards.length}</Text>
                  </Text>
                  {groupJob && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.picsButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => setPhotosJob(groupJob)}
                    >
                      <Feather name="image" size={13} color={colors.primary} />
                      <Text style={styles.picsButtonText}>Pics</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.cardStack}>
                  {group.cards.map((card) => {
                    const date = scheduledDateById.get(card.id);
                    return (
                      <JobcardRow
                        key={card.id}
                        jobcard={card}
                        jobName={group.name}
                        scheduled={scheduledIds.has(card.id)}
                        scheduledDate={date}
                        onViewCalendar={
                          onViewCalendar && date
                            ? () => onViewCalendar(date)
                            : undefined
                        }
                        onPress={() => setViewingId(card.id)}
                      />
                    );
                  })}
                </View>
              </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.cardStack}>
            {filtered.map((card) => {
              const date = scheduledDateById.get(card.id);
              return (
                <JobcardRow
                  key={card.id}
                  jobcard={card}
                  jobName={jobNameFor(card.jobId)}
                  scheduled={scheduledIds.has(card.id)}
                  scheduledDate={date}
                  onViewCalendar={
                    onViewCalendar && date
                      ? () => onViewCalendar(date)
                      : undefined
                  }
                  onPress={() => setViewingId(card.id)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <CreateJobcardModal
        visible={createOpen}
        jobs={activeJobs}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <JobcardQuickView
        jobcardId={viewingId}
        jobs={jobs}
        onClose={() => setViewingId(null)}
        onDelete={handleDelete}
      />

      <JobPhotosModal job={photosJob} onClose={() => setPhotosJob(null)} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 1100,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Lift the whole toolbar above the card list so open dropdown menus
    // (priority / calendar) render over the jobcards instead of under them.
    zIndex: 20,
  },
  toolbarSpacer: {
    flex: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  falseStartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  falseStartPillHot: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger,
  },
  falseStartText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  falseStartTextHot: {
    color: colors.danger,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  addButtonDisabled: {
    backgroundColor: colors.surfaceLight,
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  addButtonText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  cardStack: {
    gap: spacing.sm,
  },
  groupStack: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  groupHeader: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  picsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  picsButtonText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  groupCount: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
}));
