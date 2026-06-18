import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import {
  CreateJobcardModal,
  NewJobcardInput,
} from '@/components/desktop/CreateJobcardModal';
import { Toast } from '@/components/Toast';
import { priorityMeta } from '@/lib/priority';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/** Project Manager → Jobcards: every jobcard, its calendar status, and creation. */
export default function PmJobcardsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const assignments = useAppStore((s) => s.assignments);
  const addJobcard = useAppStore((s) => s.addJobcard);

  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  if (role !== 'project_manager') return <AccessDenied />;

  const jobNameFor = (jobId?: string) =>
    jobs.find((j) => j.id === jobId)?.name ?? 'Unlinked job';

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {jobcards.length}{' '}
            {jobcards.length === 1 ? 'jobcard' : 'jobcards'} · {unscheduledCount}{' '}
            not on calendar
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

        {jobcards.length === 0 ? (
          <Text style={styles.emptyText}>No jobcards yet.</Text>
        ) : (
          <View style={styles.cardStack}>
            {jobcards.map((card) => {
              const scheduled = scheduledIds.has(card.id);
              const meta = priorityMeta(card.priority);
              return (
                <View key={card.id} style={styles.jobcardRow}>
                  <View style={styles.jobcardMain}>
                    <Text style={styles.jobcardTitle} numberOfLines={1}>
                      {card.title}
                    </Text>
                    <Text style={styles.jobcardJob} numberOfLines={1}>
                      {jobNameFor(card.jobId)}
                      {card.scopes && card.scopes.length > 0
                        ? `  ·  ${card.scopes.join(', ')}`
                        : ''}
                    </Text>
                  </View>

                  <View
                    style={[styles.priorityPill, { backgroundColor: meta.bg }]}
                  >
                    <Text style={[styles.priorityText, { color: meta.fg }]}>
                      {card.priority}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      scheduled ? styles.statusPillOn : styles.statusPillOff,
                    ]}
                  >
                    <Feather
                      name={scheduled ? 'calendar' : 'clock'}
                      size={13}
                      color={scheduled ? colors.success : colors.warning}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: scheduled ? colors.success : colors.warning },
                      ]}
                    >
                      {scheduled ? 'On calendar' : 'Not on calendar'}
                    </Text>
                  </View>
                </View>
              );
            })}
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
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  cardStack: {
    gap: spacing.sm,
  },
  jobcardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
    minWidth: 84,
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 150,
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingVertical: 4,
  },
  statusPillOn: {
    backgroundColor: colors.successDim,
  },
  statusPillOff: {
    backgroundColor: colors.warningDim,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
