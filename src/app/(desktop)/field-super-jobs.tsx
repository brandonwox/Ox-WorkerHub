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
import { ArchivedJobsSection } from '@/components/desktop/ArchivedJobsSection';
import {
  CreateJobModal,
  NewJobInput,
} from '@/components/desktop/CreateJobModal';
import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { activeJobs } from '@/utils/jobArchive';
import { workRequestLinksJob } from '@/utils/workRequestJobs';

/**
 * Field Super → Jobs: searchable list of their jobs; clicking one opens the
 * job dashboard sidebar (address, flashing material, work requests, issues,
 * documents, pictures) on the right.
 */
export default function FieldSuperJobsScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const workers = useAppStore((s) => s.workers);
  const workRequests = useAppStore((s) => s.workRequests);
  const addJob = useAppStore((s) => s.addJob);
  const flash = useAppStore((s) => s.flash);

  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // "All jobs" widens the list from assigned-only to EVERY job — each row
  // then shows its assigned supers. Unassigned jobs are fully viewable AND
  // editable (helping out needs no assignment); the sidebar still offers
  // "Assign myself" to take responsibility for one.
  const [showAll, setShowAll] = useState(false);

  // By default a Field Super sees ONLY the jobs they're assigned to, Active
  // first. Archived jobs live only in the Archived section at the bottom.
  const myJobs = useMemo(
    () =>
      (me ? activeJobs(jobsForFieldSuper(jobs, me.id)) : []).sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'Active' ? -1 : 1
      ),
    [jobs, me]
  );
  const allJobs = useMemo(
    () =>
      activeJobs(jobs).sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'Active' ? -1 : 1
      ),
    [jobs]
  );

  // Sub-jobs stay out of the top-level list — they live inside their parent's
  // Sub-Jobs section (myJobs keeps them for the sidebar/quick-view lookups).
  const listJobs = useMemo(
    () => (showAll ? allJobs : myJobs).filter((job) => !job.parentJobId),
    [showAll, allJobs, myJobs]
  );

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listJobs;
    return listJobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        (job.po ?? '').toLowerCase().includes(q) ||
        (job.location ?? '').toLowerCase().includes(q)
    );
  }, [listJobs, query]);

  // Looked up in the FULL list — with "All jobs" on, an unassigned job can be
  // open in the sidebar too.
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );
  // Assignment only gates DELETING a job — the responsible supers' call (RLS
  // matches). Everything else is editable on any job.
  const meAssigned = !!(
    me && selectedJob?.fieldSuperIds?.includes(me.id)
  );

  if (role !== 'field_super') return <AccessDenied />;

  const superNamesFor = (jobFieldSuperIds?: string[]) =>
    (jobFieldSuperIds ?? [])
      .map((id) => workers.find((w) => w.id === id)?.name)
      .filter((name): name is string => !!name)
      .join(', ');

  const workRequestCountFor = (jobId: string) =>
    workRequests.filter((c) => workRequestLinksJob(c, jobId)).length;

  // No QBT jobcode here — the Finance Manager fills it in later. The creator
  // is auto-assigned to the job (store + DB trigger).
  const handleCreate = (input: NewJobInput) => {
    const created = addJob(input);
    flash(`Job "${created.name}" created`, 'success');
    setSelectedJobId(created.id);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHint}>
          A card for every job — open one for its full dashboard: address,
          flashing material, work requests, issues, documents, and pictures.
        </Text>

        <View style={styles.toolbar}>
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
          <Pressable
            style={[styles.toggle, showAll && styles.toggleOn]}
            onPress={() => setShowAll((v) => !v)}
          >
            <Feather
              name="eye"
              size={15}
              color={showAll ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.toggleText, showAll && styles.toggleTextOn]}>
              All jobs
            </Text>
          </Pressable>
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
          <Text style={styles.emptyText}>
            {showAll
              ? 'No jobs yet.'
              : 'No jobs assigned to you yet — turn on "All jobs" to browse every job and assign yourself.'}
          </Text>
        ) : visibleJobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs match “{query.trim()}”.</Text>
        ) : (
          <View style={styles.cardStack}>
            {visibleJobs.map((job) => {
              const count = workRequestCountFor(job.id);
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
                      {/* Jobs broken into sub-jobs read as folders, not
                          standalone jobsites. */}
                      {job.hasSubJobs && (
                        <Text style={styles.masterFolderLabel}>
                          Master Folder
                        </Text>
                      )}
                      <Text style={styles.jobName} numberOfLines={1}>
                        {job.name}
                      </Text>
                      {job.po ? (
                        <Text style={styles.poText}>{job.po}</Text>
                      ) : null}
                      {job.status === 'Finished' && (
                        <View style={styles.archivedPill}>
                          <Text style={styles.archivedText}>Finished</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.jobLocation} numberOfLines={1}>
                      {job.location || 'No location set'}
                    </Text>
                    {/* With "All jobs" on, each row shows who's assigned. */}
                    {showAll && (
                      <Text style={styles.jobSupers} numberOfLines={1}>
                        {superNamesFor(job.fieldSuperIds) ||
                          'No Field Super assigned'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.workRequestCount}>
                    {count} {count === 1 ? 'work request' : 'work requests'}
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

        <ArchivedJobsSection />
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
        editable
        canCreateWorkRequests
        // Deleting a job stays with the supers assigned to it (RLS matches);
        // everything else is open to any super helping out.
        canDelete={meAssigned}
        quickViewJobs={myJobs}
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
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  toggleOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  toggleText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  toggleTextOn: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
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
  masterFolderLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  poText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  jobLocation: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  jobSupers: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  workRequestCount: {
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
