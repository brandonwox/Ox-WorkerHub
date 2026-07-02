import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { CreateJobModal, NewJobInput } from '@/components/desktop/CreateJobModal';
import { EditJobModal, JobChanges } from '@/components/desktop/EditJobModal';
import { Toast } from '@/components/Toast';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job } from '@/types';

export default function JobsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const workers = useAppStore((s) => s.workers);
  const addJob = useAppStore((s) => s.addJob);
  const updateJob = useAppStore((s) => s.updateJob);
  const removeJob = useAppStore((s) => s.removeJob);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const projectManagers = useMemo(
    () => workers.filter((w) => w.role === 'project_manager'),
    [workers]
  );

  if (role !== 'operator') return <AccessDenied />;

  const handleCreate = (input: NewJobInput) => {
    addJob(input);
    setToast(`Job "${input.name}" created`);
  };

  const handleSave = (id: string, changes: JobChanges) => {
    updateJob(id, changes);
    setToast(`Job "${changes.name}" updated`);
  };

  const handleDelete = (id: string) => {
    const name = jobs.find((j) => j.id === id)?.name ?? 'Job';
    removeJob(id);
    setToast(`Job "${name}" deleted`);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} ·{' '}
            {jobs.filter((j) => j.status === 'Active').length} active
          </Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => setCreateOpen(true)}
          >
            <Feather name="plus" size={16} color={colors.textPrimary} />
            <Text style={styles.addButtonText}>Create job</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onEdit={() => setEditing(job)} />
          ))}
        </View>
      </ScrollView>

      <Toast message={toast} onDone={() => setToast(null)} />

      <CreateJobModal
        visible={createOpen}
        projectManagers={projectManagers}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <EditJobModal
        job={editing}
        projectManagers={projectManagers}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </View>
  );
}

/** Square-ish job card shown in the grid; the edit button opens the full editor. */
function JobCard({ job, onEdit }: { job: Job; onEdit: () => void }) {
  const archived = job.status === 'Archived';
  const unmapped = !job.qbtJobcodeId;
  const pmCount = job.pmIds?.length ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={2}>
          {job.name}
        </Text>
        <View
          style={[styles.statusBadge, archived && styles.statusBadgeArchived]}
        >
          <Text
            style={[styles.statusText, archived && styles.statusTextArchived]}
          >
            {job.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Feather name="hash" size={14} color={colors.textTertiary} />
          {unmapped ? (
            <Text style={[styles.detailValue, styles.unmapped]}>
              QBT code unmapped
            </Text>
          ) : (
            <Text style={styles.detailValue} numberOfLines={1}>
              QBT {job.qbtJobcodeId}
            </Text>
          )}
        </View>
        <View style={styles.detailRow}>
          <Feather name="user" size={14} color={colors.textTertiary} />
          {pmCount === 0 ? (
            <Text style={[styles.detailValue, styles.unmapped]}>
              No PM assigned
            </Text>
          ) : (
            <Text style={styles.detailValue} numberOfLines={1}>
              {pmCount} {pmCount === 1 ? 'PM' : 'PMs'} assigned
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
      >
        <Feather name="edit-2" size={14} color={colors.textPrimary} />
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
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
    width: '100%',
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
  pressed: {
    opacity: 0.85,
  },
  addButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  card: {
    width: 300,
    minHeight: 240,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.successDim,
  },
  statusBadgeArchived: {
    backgroundColor: colors.surfaceLight,
  },
  statusText: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusTextArchived: {
    color: colors.textTertiary,
  },
  cardBody: {
    flex: 1,
    gap: spacing.sm + 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailValue: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  unmapped: {
    color: colors.warning,
    fontFamily: fonts.medium,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
});
