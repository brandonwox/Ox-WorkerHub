import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import {
  CreateJobcardModal,
  NewJobcardInput,
} from '@/components/desktop/CreateJobcardModal';
import {
  EditJobcardModal,
  JobcardChanges,
} from '@/components/desktop/EditJobcardModal';
import {
  JobcardFilters,
  ScheduleFilter,
} from '@/components/desktop/JobcardFilters';
import { JobcardRow } from '@/components/desktop/JobcardRow';
import { Toast } from '@/components/Toast';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard, PRIORITY_PRESETS } from '@/types';

const PRESET_ORDER = PRIORITY_PRESETS as readonly string[];

/** Field Super → Jobcards: every jobcard, its calendar status, and creation. */
export default function FieldSuperJobcardsScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);
  const allJobcards = useAppStore((s) => s.jobcards);
  const assignments = useAppStore((s) => s.assignments);
  const addJobcard = useAppStore((s) => s.addJobcard);
  const updateJobcard = useAppStore((s) => s.updateJobcard);
  const deleteJobcard = useAppStore((s) => s.deleteJobcard);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Jobcard | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filters / sort (all stack).
  const [search, setSearch] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleFilter>('all');
  const [groupByJob, setGroupByJob] = useState(false);

  // A Field Super works only within their own jobs — and, transitively, only the
  // jobcards that hang off those jobs. Scope both here so every count/filter
  // below sees just this Field Super's slice.
  const jobs = useMemo(
    () => (me ? jobsForFieldSuper(allJobs, me.id) : []),
    [allJobs, me]
  );
  const myJobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  const jobcards = useMemo(
    () => allJobcards.filter((c) => c.jobId != null && myJobIds.has(c.jobId)),
    [allJobcards, myJobIds]
  );

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'Active'),
    [jobs]
  );

  // The edit form offers active jobs plus the card's own parent (which may be
  // archived) so an edit never silently drops an archived-job parent.
  const editJobOptions = useMemo(() => {
    if (!editing?.jobId) return activeJobs;
    if (activeJobs.some((j) => j.id === editing.jobId)) return activeJobs;
    const parent = jobs.find((j) => j.id === editing.jobId);
    return parent ? [parent, ...activeJobs] : activeJobs;
  }, [editing, activeJobs, jobs]);

  // "On the calendar" = the jobcard has a row in `assignments` (Scheduler placed it).
  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.jobcardId)),
    [assignments]
  );
  const unscheduledCount = useMemo(
    () => jobcards.filter((c) => !scheduledIds.has(c.id)).length,
    [jobcards, scheduledIds]
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => map.set(j.id, j.name));
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

  if (role !== 'field_super') return <AccessDenied />;

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
      scopes: input.scopes,
      tasks: input.tasks,
      readiness: input.readiness,
      materials: input.materials,
      flashingMaterial: input.flashingMaterial,
      notes: input.notes,
      details: { generalContractor: '', managerName: '', managerPhone: '' },
    });
    setToast(`Jobcard "${input.title}" created`);
  };

  const handleEditSave = (id: string, changes: JobcardChanges) => {
    updateJobcard(id, changes);
    setToast(`Jobcard "${changes.title}" updated`);
  };

  const handleDelete = (id: string) => {
    const title = editing?.title;
    deleteJobcard(id);
    setToast(title ? `Jobcard "${title}" deleted` : 'Jobcard deleted');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          {jobcards.length} {jobcards.length === 1 ? 'jobcard' : 'jobcards'} ·{' '}
          {unscheduledCount} not on calendar
        </Text>

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
            <Feather name="plus" size={16} color={colors.textPrimary} />
            <Text style={styles.addButtonText}>Create jobcard</Text>
          </Pressable>
        </View>

        {jobcards.length === 0 ? (
          <Text style={styles.emptyText}>No jobcards yet.</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No jobcards match these filters.</Text>
        ) : groups ? (
          <View style={styles.groupStack}>
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupHeader}>
                  {group.name}{' '}
                  <Text style={styles.groupCount}>· {group.cards.length}</Text>
                </Text>
                <View style={styles.cardStack}>
                  {group.cards.map((card) => (
                    <JobcardRow
                      key={card.id}
                      jobcard={card}
                      jobName={group.name}
                      scheduled={scheduledIds.has(card.id)}
                      onPress={() => setEditing(card)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cardStack}>
            {filtered.map((card) => (
              <JobcardRow
                key={card.id}
                jobcard={card}
                jobName={jobNameFor(card.jobId)}
                scheduled={scheduledIds.has(card.id)}
                onPress={() => setEditing(card)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Toast message={toast} onDone={() => setToast(null)} />

      <CreateJobcardModal
        visible={createOpen}
        jobs={activeJobs}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <EditJobcardModal
        jobcard={editing}
        jobs={editJobOptions}
        onClose={() => setEditing(null)}
        onSave={handleEditSave}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.textPrimary,
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
});
