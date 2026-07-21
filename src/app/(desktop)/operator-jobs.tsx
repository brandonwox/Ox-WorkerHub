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
import { CreateJobModal, NewJobInput } from '@/components/desktop/CreateJobModal';
import { EditJobModal, JobChanges } from '@/components/desktop/EditJobModal';
import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';

export default function JobsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const workers = useAppStore((s) => s.workers);
  const addJob = useAppStore((s) => s.addJob);
  const updateJob = useAppStore((s) => s.updateJob);
  const removeJob = useAppStore((s) => s.removeJob);
  const flash = useAppStore((s) => s.flash);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const fieldSupers = useMemo(
    () => workers.filter((w) => w.role === 'field_super'),
    [workers]
  );

  // Sub-jobs stay out of the top-level grid — they live inside their parent's
  // Sub-Jobs section (the sidebar navigates to them from there).
  const topLevelJobs = useMemo(
    () => jobs.filter((job) => !job.parentJobId),
    [jobs]
  );

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topLevelJobs;
    return topLevelJobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        (job.po ?? '').toLowerCase().includes(q) ||
        (job.location ?? '').toLowerCase().includes(q)
    );
  }, [topLevelJobs, query]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  if (role !== 'operator') return <AccessDenied />;

  const handleCreate = (input: NewJobInput) => {
    addJob(input);
    flash(`Job "${input.name}" created`, 'success');
  };

  const handleSave = (id: string, changes: JobChanges) => {
    updateJob(id, changes);
    flash(`Job "${changes.name}" updated`, 'success');
  };

  const handleDelete = (id: string) => {
    const name = jobs.find((j) => j.id === id)?.name ?? 'Job';
    removeJob(id);
    flash(`Job "${name}" deleted`, 'success');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {topLevelJobs.length} {topLevelJobs.length === 1 ? 'job' : 'jobs'} ·{' '}
            {topLevelJobs.filter((j) => j.status === 'Active').length} active
          </Text>
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => setCreateOpen(true)}
          >
            <Feather name="plus" size={16} color={colors.textOnAccent} />
            <Text style={styles.addButtonText}>Create job</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search jobs by name, PO, or address…"
            placeholderTextColor={colors.textTertiary}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={15} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        {visibleJobs.length === 0 && query.trim().length > 0 ? (
          <Text style={styles.noMatches}>No jobs match “{query.trim()}”.</Text>
        ) : (
          <View style={styles.grid}>
            {visibleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onOpen={() => setSelectedJobId(job.id)}
                onEdit={() => setEditing(job)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CreateJobModal
        visible={createOpen}
        fieldSupers={fieldSupers}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <EditJobModal
        job={editing}
        fieldSupers={fieldSupers}
        subJobCount={
          editing ? jobs.filter((j) => j.parentJobId === editing.id).length : 0
        }
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <JobDashboardSidebar
        job={selectedJob}
        onClose={() => setSelectedJobId(null)}
        editable
        canDelete
        quickViewJobs={jobs}
        onOpenJob={setSelectedJobId}
      />
    </View>
  );
}

/** Square-ish job card: click to open the dashboard sidebar; the edit button
    opens the full editor. */
function JobCard({
  job,
  onOpen,
  onEdit,
}: {
  job: Job;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const archived = job.status === 'Finished';
  const unmapped = !job.qbtJobcodeId;
  const fieldSuperCount = job.fieldSuperIds?.length ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onOpen}
    >
      <View style={styles.cardHeader}>
        <View style={styles.nameWrap}>
          {/* Jobs broken into sub-jobs read as folders, not standalone
              jobsites. */}
          {job.hasSubJobs && (
            <Text style={styles.masterFolderLabel}>Master Folder</Text>
          )}
          <Text style={styles.name} numberOfLines={2}>
            {job.name}
            {job.po ? <Text style={styles.poText}>  PO {job.po}</Text> : null}
          </Text>
        </View>
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
          {fieldSuperCount === 0 ? (
            <Text style={[styles.detailValue, styles.unmapped]}>
              No Field Super assigned
            </Text>
          ) : (
            <Text style={styles.detailValue} numberOfLines={1}>
              {fieldSuperCount}{' '}
              {fieldSuperCount === 1 ? 'Field Super' : 'Field Supers'} assigned
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
    </Pressable>
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
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    maxWidth: 480,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    outlineWidth: 0,
  },
  noMatches: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  cardPressed: {
    opacity: 0.92,
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
  nameWrap: {
    flex: 1,
    gap: 1,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  masterFolderLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  poText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
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
}));
