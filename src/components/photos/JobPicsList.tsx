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

import {
  recentClockedJobs,
  useAppStore,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { jobDisplayName } from '@/utils/jobName';

interface Props {
  /** Open a job's photo page/modal. */
  onSelectJob: (job: Job) => void;
}

/**
 * The Jobs tab's dashboard: with no search, EVERY job ordered by recency —
 * jobs the worker clocked into first (most recent first, the running shift
 * counting as most recent of all), then the rest by their latest photo, then
 * alphabetical. Typing searches every job by name — archived included — so old
 * work can still be photographed and browsed.
 */
export function JobPicsList({ onSelectJob }: Props) {
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const workRequests = useAppStore((s) => s.workRequests);
  const logs = useAppStore((s) => s.logs);
  const activeShift = useAppStore((s) => s.activeShift);
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);

  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const byRecency = useMemo(() => {
    const clocked = me
      ? recentClockedJobs(
          { logs, workRequests, jobs, activeShift },
          me.id,
          Number.MAX_SAFE_INTEGER
        )
      : [];
    const clockedIds = new Set(clocked.map((job) => job.id));
    // Jobs never clocked into rank by their newest photo, then by name.
    const latestPhotoAt = new Map<string, string>();
    for (const p of [...jobPhotos, ...pendingPhotos]) {
      const current = latestPhotoAt.get(p.jobId);
      if (!current || p.takenAt > current) latestPhotoAt.set(p.jobId, p.takenAt);
    }
    const rest = jobs
      .filter((job) => !clockedIds.has(job.id))
      .sort((a, b) => {
        const pa = latestPhotoAt.get(a.id);
        const pb = latestPhotoAt.get(b.id);
        if (pa && pb) return pb.localeCompare(pa);
        if (pa || pb) return pa ? -1 : 1;
        return jobDisplayName(a, jobs).localeCompare(jobDisplayName(b, jobs));
      });
    return [...clocked, ...rest];
  }, [me, logs, workRequests, jobs, activeShift, jobPhotos, pendingPhotos]);

  // Sub-jobs are listed like any job, under their conjoined name ("Vista
  // Homes Lot 2") — searching the parent's name, the sub-job's name, or the
  // job's PO hits.
  const results = useMemo(() => {
    if (!query) return byRecency;
    return jobs
      .filter(
        (job) =>
          jobDisplayName(job, jobs).toLowerCase().includes(query) ||
          (job.po ?? '').toLowerCase().includes(query)
      )
      .sort((a, b) =>
        jobDisplayName(a, jobs).localeCompare(jobDisplayName(b, jobs))
      );
  }, [query, byRecency, jobs]);

  const photoCountFor = (jobId: string) =>
    jobPhotos.filter((p) => p.jobId === jobId).length +
    pendingPhotos.filter((p) => p.jobId === jobId).length;

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search any job by name or PO…"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Feather name="x" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionLabel}>
        {query ? 'Search results' : 'All jobs · recent first'}
      </Text>

      <ScrollView contentContainerStyle={styles.listContent}>
        {results.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="briefcase" size={30} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {query ? 'No jobs match' : 'No jobs yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? 'Try a different job name.'
                : 'Jobs show up here as the office creates them.'}
            </Text>
          </View>
        ) : (
          results.map((job) => {
            const count = photoCountFor(job.id);
            return (
              <Pressable
                key={job.id}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => onSelectJob(job)}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowTitleWrap}>
                    {/* Jobs broken into sub-jobs read as folders, not
                        standalone jobsites. */}
                    {job.hasSubJobs && (
                      <Text style={styles.masterFolderLabel}>
                        Master Folder
                      </Text>
                    )}
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {jobDisplayName(job, jobs)}
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
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {job.location || 'No location set'}
                  </Text>
                </View>
                {count > 0 && (
                  <View style={styles.countPill}>
                    <Feather name="image" size={11} color={colors.primary} />
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  flex: {
    flex: 1,
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
    marginHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.surfaceLight,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  masterFolderLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  poText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  rowSub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
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
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  countText: {
    color: colors.primary,
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
    maxWidth: 280,
  },
}));
