import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import {
  CreateJobcardModal,
  NewJobcardInput,
} from '@/components/desktop/CreateJobcardModal';
import { Toast } from '@/components/Toast';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job, JobcardPriority } from '@/types';

const PRIORITY_META: Record<
  JobcardPriority,
  { bg: string; fg: string }
> = {
  Low: { bg: colors.surfaceLight, fg: colors.textSecondary },
  Medium: { bg: colors.primaryDim, fg: colors.primary },
  High: { bg: colors.dangerDim, fg: colors.danger },
};

export default function PmScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const assignments = useAppStore((s) => s.assignments);
  const addJobcard = useAppStore((s) => s.addJobcard);
  const updateJob = useAppStore((s) => s.updateJob);

  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'Active'),
    [jobs]
  );

  // "Unassigned" is derived: a jobcard with no row in `assignments`.
  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.jobcardId)),
    [assignments]
  );
  const unassignedCount = useMemo(
    () => jobcards.filter((c) => !assignedIds.has(c.id)).length,
    [jobcards, assignedIds]
  );

  if (role !== 'project_manager') return <AccessDenied />;

  const jobNameFor = (jobId?: string) =>
    jobs.find((j) => j.id === jobId)?.name ?? 'Unlinked job';

  const handleCreate = (input: NewJobcardInput) => {
    // addJobcard snapshots the parent Job's flashingMaterial — we don't pass it.
    addJobcard({
      jobId: input.jobId,
      title: input.title,
      address: input.address,
      date: input.date,
      priority: input.priority,
      materials: input.materials,
      scopeOfWork: input.scopeOfWork,
      details: { generalContractor: '', managerName: '', managerPhone: '' },
    });
    setToast(`Jobcard "${input.title}" created`);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {jobcards.length}{' '}
            {jobcards.length === 1 ? 'jobcard' : 'jobcards'} ·{' '}
            {unassignedCount} unassigned
          </Text>
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

        {/* Section A — Jobs & flashing (the PM's one writable Job field). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobs &amp; flashing</Text>
          <Text style={styles.sectionHint}>
            Set each active job&apos;s site-wide flashing material. New jobcards
            inherit it automatically. You can only edit flashing here.
          </Text>

          <View style={styles.table}>
            <View style={[styles.row, styles.headRow]}>
              <Text style={[styles.cell, styles.colName, styles.headText]}>
                Job
              </Text>
              <Text style={[styles.cell, styles.colLocation, styles.headText]}>
                Location
              </Text>
              <Text style={[styles.cell, styles.colFlashing, styles.headText]}>
                Flashing material
              </Text>
            </View>

            {activeJobs.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>
                  No active jobs yet — the Operator creates jobs.
                </Text>
              </View>
            ) : (
              activeJobs.map((job) => (
                <View key={job.id} style={styles.row}>
                  <View style={[styles.cell, styles.colName]}>
                    <Text style={styles.name} numberOfLines={1}>
                      {job.name}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.colLocation]}>
                    <Text style={styles.location} numberOfLines={2}>
                      {job.location}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.colFlashing]}>
                    <FlashingCell
                      job={job}
                      onCommit={(flashingMaterial) =>
                        updateJob(job.id, { flashingMaterial })
                      }
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Section B — Jobcards backlog with assigned/unassigned feedback. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jobcards</Text>
          <Text style={styles.sectionHint}>
            Newest first. Unassigned cards sit in the Scheduler&apos;s backlog
            until a crew &amp; date are assigned.
          </Text>

          {jobcards.length === 0 ? (
            <View style={styles.section}>
              <Text style={styles.emptyText}>No jobcards yet.</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {jobcards.map((card) => {
                const assigned = assignedIds.has(card.id);
                const meta = PRIORITY_META[card.priority];
                return (
                  <View key={card.id} style={styles.jobcardRow}>
                    <View style={styles.jobcardMain}>
                      <Text style={styles.jobcardTitle} numberOfLines={1}>
                        {card.title}
                      </Text>
                      <Text style={styles.jobcardJob} numberOfLines={1}>
                        {jobNameFor(card.jobId)}
                      </Text>
                    </View>

                    <View style={[styles.priorityPill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.priorityText, { color: meta.fg }]}>
                        {card.priority}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.assignPill,
                        assigned ? styles.assignPillOn : styles.assignPillOff,
                      ]}
                    >
                      <Feather
                        name={assigned ? 'check-circle' : 'clock'}
                        size={13}
                        color={assigned ? colors.success : colors.warning}
                      />
                      <Text
                        style={[
                          styles.assignText,
                          { color: assigned ? colors.success : colors.warning },
                        ]}
                      >
                        {assigned ? 'Assigned' : 'Unassigned'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Toast message={toast} onDone={() => setToast(null)} />

      <CreateJobcardModal
        visible={createOpen}
        jobs={activeJobs}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </View>
  );
}

/** Inline editable site-wide flashing material; commits on blur. */
function FlashingCell({
  job,
  onCommit,
}: {
  job: Job;
  onCommit: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(job.flashingMaterial ?? '');

  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed || undefined);
  };

  const unset = !job.flashingMaterial;

  return (
    <View style={[styles.flashWrap, unset && styles.flashWrapUnset]}>
      <TextInput
        style={styles.flashInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        placeholder="not set"
        placeholderTextColor={colors.textTertiary}
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
    gap: spacing.xl,
    maxWidth: 1100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  sectionHint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 640,
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headRow: {
    backgroundColor: colors.surfaceLight,
  },
  headText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cell: {
    paddingRight: spacing.md,
    justifyContent: 'center',
  },
  colName: {
    flex: 3,
  },
  colLocation: {
    flex: 3,
  },
  colFlashing: {
    flex: 3,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  location: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  emptyRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  flashWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  flashWrapUnset: {
    borderColor: colors.border,
  },
  flashInput: {
    minWidth: 140,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  cardList: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  jobcardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  jobcardMain: {
    flex: 1,
    gap: 2,
  },
  jobcardTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  jobcardJob: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  priorityPill: {
    width: 76,
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingVertical: 4,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  assignPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 120,
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingVertical: 4,
  },
  assignPillOn: {
    backgroundColor: colors.successDim,
  },
  assignPillOff: {
    backgroundColor: colors.warningDim,
  },
  assignText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
