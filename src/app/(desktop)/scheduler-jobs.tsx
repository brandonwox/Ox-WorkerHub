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
  CreateJobModal,
  NewJobInput,
} from '@/components/desktop/CreateJobModal';
import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * Scheduler → Jobs: searchable list of every job; clicking one opens the job
 * dashboard sidebar. Read-only on job fields (the pencil is hidden), but
 * schedulers may create jobs and manage sub-jobs — RLS matches. New jobs
 * carry no QBT jobcode; the Finance Manager fills it in later.
 */
export default function SchedulerJobsScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const addJob = useAppStore((s) => s.addJob);
  const flash = useAppStore((s) => s.flash);

  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Every job, Active first. Sub-jobs stay out of the top-level list — they
  // live inside their parent's Sub-Jobs section.
  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'Active' ? -1 : 1
      ),
    [jobs]
  );
  const listJobs = useMemo(
    () => sortedJobs.filter((job) => !job.parentJobId),
    [sortedJobs]
  );

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listJobs;
    return listJobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        (job.location ?? '').toLowerCase().includes(q)
    );
  }, [listJobs, query]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  if (role !== 'scheduler') return <AccessDenied />;

  const jobcardCountFor = (jobId: string) =>
    jobcards.filter((c) => c.jobId === jobId).length;

  const handleCreate = (input: NewJobInput) => {
    const created = addJob(input);
    flash(`Job "${created.name}" created`, 'success');
    setSelectedJobId(created.id);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHint}>
          A card for every job — open one for its dashboard: jobcards, issues,
          documents, sub-jobs, and pictures.
        </Text>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={15} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search jobs by name or address…"
              placeholderTextColor={colors.textTertiary}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setCreateOpen(true)}
          >
            <Feather name="plus" size={16} color={colors.textOnAccent} />
            <Text style={styles.addButtonText}>Create job</Text>
          </Pressable>
        </View>

        {listJobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs yet.</Text>
        ) : visibleJobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs match “{query.trim()}”.</Text>
        ) : (
          <View style={styles.cardStack}>
            {visibleJobs.map((job) => {
              const count = jobcardCountFor(job.id);
              const selected = job.id === selectedJobId;
              return (
                <Pressable
                  key={job.id}
                  style={({ pressed }) => [
                    styles.jobCard,
                    selected && styles.jobCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() =>
                    setSelectedJobId((id) => (id === job.id ? null : job.id))
                  }
                >
                  <View style={styles.jobCardMain}>
                    <View style={styles.jobCardTitleRow}>
                      <Text style={styles.jobName} numberOfLines={1}>
                        {job.name}
                      </Text>
                      {job.status === 'Finished' && (
                        <View style={styles.archivedPill}>
                          <Text style={styles.archivedText}>Finished</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.jobLocation} numberOfLines={1}>
                      {job.location || 'No location set'}
                    </Text>
                  </View>
                  <Text style={styles.jobcardCount}>
                    {count} {count === 1 ? 'jobcard' : 'jobcards'}
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <CreateJobModal
        visible={createOpen}
        mode="field"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <JobDashboardSidebar
        job={selectedJob}
        onClose={() => setSelectedJobId(null)}
        editable={false}
        canManageSubJobs
        quickViewJobs={jobs}
        onOpenJob={setSelectedJobId}
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
  sectionHint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 640,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchWrap: {
    flex: 1,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  addButtonText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    outlineWidth: 0,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  cardStack: {
    gap: spacing.sm,
  },
  jobCard: {
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
  jobCardSelected: {
    borderColor: colors.primary,
  },
  jobCardMain: {
    flex: 1,
    gap: 2,
  },
  jobCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobName: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  jobLocation: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  jobcardCount: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  archivedPill: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  archivedText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
}));
