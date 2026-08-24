import { Feather } from '@expo/vector-icons';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import {
  WorkRequestQuickView,
  NewWorkRequestInput,
} from '@/components/desktop/WorkRequestQuickView';
import {
  WorkRequestFilters,
  ScheduleFilter,
} from '@/components/desktop/WorkRequestFilters';
import { WorkRequestRow } from '@/components/desktop/WorkRequestRow';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job, PRIORITY_PRESETS } from '@/types';
import { jobDisplayName } from '@/utils/jobName';
import { newWorkRequestPayload } from '@/utils/workRequestCreate';
import {
  workRequestJobIds,
  workRequestJobsLabel,
  workRequestPoLabel,
} from '@/utils/workRequestJobs';

const PRESET_ORDER = PRIORITY_PRESETS as readonly string[];

interface WorkRequestsScreenProps {
  /**
   * The jobs this viewer may work within — the route decides the scope (a
   * Field Super sees only their own jobs, the Scheduler sees every job) and
   * the screen shows just the work requests hanging off them.
   */
  jobs: Job[];
  /** Show the false-starts-this-week counter (the Field Super's page). */
  showFalseStarts?: boolean;
  /**
   * Jump to the viewer's calendar with `date` highlighted. When set, hovering
   * a scheduled row's date turns it into a "View on calendar" link.
   */
  onViewCalendar?: (date: string) => void;
  /**
   * Label rows (and the quick view header) with the linked job's PO instead
   * of its name — the Field Super's page identifies jobs by PO. Search still
   * matches job names either way.
   */
  poSubtitles?: boolean;
  /**
   * Open this work request's sidebar on arrival — notification deep links
   * (the pages read it from the `openWorkRequest` URL param).
   */
  openWorkRequestId?: string;
  /** Changes on every deep-link click so the same card re-opens. */
  openWorkRequestNonce?: string;
}

/** Desktop work requests workspace: every work request in scope, its calendar status, and creation. */
export function WorkRequestsScreen({
  jobs,
  showFalseStarts = false,
  onViewCalendar,
  poSubtitles = false,
  openWorkRequestId,
  openWorkRequestNonce,
}: WorkRequestsScreenProps) {
  const allWorkRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const addWorkRequest = useAppStore((s) => s.addWorkRequest);
  const deleteWorkRequest = useAppStore((s) => s.deleteWorkRequest);
  const flash = useAppStore((s) => s.flash);
  const role = useCurrentRole();

  // The right sidebar shows either one work request or the creation draft —
  // opening one closes the other.
  const [createOpen, setCreateOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  // A work request's parent-job link opens the job dashboard ON TOP of the work request
  // sidebar; its back arrow returns here.
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const openCreate = () => {
    setViewingId(null);
    setOpenJobId(null);
    setCreateOpen(true);
  };
  const openCard = (id: string) => {
    setCreateOpen(false);
    setOpenJobId(null);
    setViewingId(id);
  };
  const closeSidebar = () => {
    setCreateOpen(false);
    setOpenJobId(null);
    setViewingId(null);
  };

  // Notification deep link: open the card's sidebar once it exists in the
  // store (mirrors CalendarBoard's openCardId effect). The nonce is a dep so
  // re-clicking the same notification re-opens a closed sidebar.
  useEffect(() => {
    if (!openWorkRequestId) return;
    void openWorkRequestNonce;
    if (
      useAppStore.getState().workRequests.some((c) => c.id === openWorkRequestId)
    ) {
      setCreateOpen(false);
      setOpenJobId(null);
      setViewingId(openWorkRequestId);
    }
  }, [openWorkRequestId, openWorkRequestNonce]);

  // Filters / sort (all stack).
  const [search, setSearch] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleFilter>('all');
  const [groupByJob, setGroupByJob] = useState(false);

  const myJobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  // In scope: cards linked to any of the viewer's jobs, plus STANDALONE cards
  // (no parent job at all — they belong to no one's job list, so every
  // work-requests page shows them; RLS matches).
  const workRequests = useMemo(
    () =>
      allWorkRequests.filter((c) => {
        const linked = workRequestJobIds(c);
        return linked.length === 0 || linked.some((id) => myJobIds.has(id));
      }),
    [allWorkRequests, myJobIds]
  );

  // "On the calendar" = the work request has a row in `assignments` (Scheduler placed it).
  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.workRequestId)),
    [assignments]
  );
  const unscheduledCount = useMemo(
    () => workRequests.filter((c) => !scheduledIds.has(c.id)).length,
    [workRequests, scheduledIds]
  );

  // The day each scheduled card shows in its status pill: its next upcoming
  // assignment date, or the most recent one when they're all in the past.
  const scheduledDateById = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const map = new Map<string, string>();
    const byCard = new Map<string, string[]>();
    for (const a of assignments) {
      const dates = byCard.get(a.workRequestId) ?? [];
      dates.push(a.date);
      byCard.set(a.workRequestId, dates);
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
    return workRequests.filter((card) => {
      if (card.status !== 'False Start') return false;
      const dates = assignments
        .filter((a) => a.workRequestId === card.id)
        .map((a) => a.date);
      return dates.length > 0 ? dates.some(inWeek) : inWeek(card.date);
    }).length;
  }, [showFalseStarts, workRequests, assignments]);

  // Sub-jobs display conjoined with their parent's name ("Vista Homes Lot 2");
  // multi-linked cards list every sibling ("Vista Homes Lot 2, Lot 5").
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => map.set(j.id, jobDisplayName(j, jobs)));
    return map;
  }, [jobs]);
  const jobNameFor = (jobId?: string) =>
    (jobId && nameById.get(jobId)) || 'No parent job';
  const cardJobLabel = (card: (typeof allWorkRequests)[number]) =>
    workRequestJobsLabel(card, jobs) || 'No parent job';
  // What renders under each row's title: the job name, or just the PO on
  // PO-labeled pages. (cardJobLabel stays name-based for search matching.)
  const rowSubtitle = (card: (typeof allWorkRequests)[number]) =>
    poSubtitles
      ? workRequestPoLabel(card, jobs) || 'No parent job'
      : cardJobLabel(card);
  // Job POs match the search too (anywhere job names do).
  const poById = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => j.po && map.set(j.id, j.po));
    return map;
  }, [jobs]);

  // Distinct priorities present, ordered presets-first then alphabetical.
  const priorities = useMemo(() => {
    const distinct = [...new Set(workRequests.map((c) => c.priority))];
    return distinct.sort((a, b) => {
      const ia = PRESET_ORDER.indexOf(a);
      const ib = PRESET_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [workRequests]);

  // Apply search + priority + schedule filters (stacking).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workRequests.filter((card) => {
      if (q) {
        const pos = workRequestJobIds(card)
          .map((id) => poById.get(id) ?? '')
          .join(' ');
        const hay = `${card.title} ${cardJobLabel(card)} ${pos}`.toLowerCase();
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
  }, [workRequests, search, selectedPriorities, schedule, scheduledIds, nameById, poById]);

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

  const handleCreate = (input: NewWorkRequestInput) => {
    addWorkRequest(newWorkRequestPayload(input, jobs));
    flash(`Work Request "${input.title}" created`, 'success');
  };

  const handleDelete = (id: string) => {
    const title = allWorkRequests.find((c) => c.id === id)?.title;
    deleteWorkRequest(id);
    flash(title ? `Work Request "${title}" deleted` : 'Work Request deleted', 'success');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>
            {workRequests.length} {workRequests.length === 1 ? 'work request' : 'work requests'} ·{' '}
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
          {workRequests.length > 0 ? (
            <WorkRequestFilters
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
          {/* Always enabled — with no active jobs a standalone (no-parent-job)
              work request can still be created. */}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
            onPress={openCreate}
          >
            <Feather name="plus" size={16} color={colors.textOnAccent} />
            <Text style={styles.addButtonText}>Create work request</Text>
          </Pressable>
        </View>

        {workRequests.length === 0 ? (
          <Text style={styles.emptyText}>No work requests yet.</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No work requests match these filters.</Text>
        ) : groups ? (
          <View style={styles.groupStack}>
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupHeader}>
                  {group.name}{' '}
                  <Text style={styles.groupCount}>· {group.cards.length}</Text>
                </Text>
                <View style={styles.cardStack}>
                  {group.cards.map((card) => {
                    const date = scheduledDateById.get(card.id);
                    return (
                      <WorkRequestRow
                        key={card.id}
                        workRequest={card}
                        jobName={poSubtitles ? rowSubtitle(card) : group.name}
                        scheduled={scheduledIds.has(card.id)}
                        scheduledDate={date}
                        onViewCalendar={
                          onViewCalendar && date
                            ? () => onViewCalendar(date)
                            : undefined
                        }
                        onPress={() => openCard(card.id)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cardStack}>
            {filtered.map((card) => {
              const date = scheduledDateById.get(card.id);
              return (
                <WorkRequestRow
                  key={card.id}
                  workRequest={card}
                  jobName={rowSubtitle(card)}
                  scheduled={scheduledIds.has(card.id)}
                  scheduledDate={date}
                  onViewCalendar={
                    onViewCalendar && date
                      ? () => onViewCalendar(date)
                      : undefined
                  }
                  onPress={() => openCard(card.id)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Viewing and creating share the same right sidebar (the work request
          layout; creation adds Cancel / Create Work Request at the bottom). */}
      <WorkRequestQuickView
        variant="sidebar"
        workRequestId={viewingId}
        creating={createOpen}
        jobs={jobs}
        poHeader={poSubtitles}
        onClose={closeSidebar}
        onDelete={handleDelete}
        onCreate={handleCreate}
        onOpenJob={setOpenJobId}
      />

      {/* The work request's parent-job link opens the job dashboard over the
          work request sidebar (rendered after = stacked on top); back returns. */}
      <JobDashboardSidebar
        job={jobs.find((j) => j.id === openJobId) ?? null}
        onClose={closeSidebar}
        onBack={() => setOpenJobId(null)}
        editable={role === 'field_super'}
        // Only the Scheduler and Field Supers render this screen — both may
        // manage sub-jobs, delete jobs, edit flashing material, and create
        // work requests (RLS matches).
        canEditFlashing
        canCreateWorkRequests
        canManageSubJobs
        canDelete
        quickViewJobs={jobs}
        onOpenJob={setOpenJobId}
      />
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
    // (priority / calendar) render over the work requests instead of under them.
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
  groupHeader: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  groupCount: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
}));
