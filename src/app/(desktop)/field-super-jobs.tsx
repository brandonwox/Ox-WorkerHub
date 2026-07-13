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
import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * Field Super → Jobs: searchable list of their jobs; clicking one opens the
 * job dashboard sidebar (address, flashing material, jobcards, issues,
 * documents, pictures) on the right.
 */
export default function FieldSuperJobsScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);

  const [query, setQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // A Field Super sees ONLY the jobs they're assigned to, Active first.
  const myJobs = useMemo(
    () =>
      (me ? jobsForFieldSuper(jobs, me.id) : []).sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'Active' ? -1 : 1
      ),
    [jobs, me]
  );

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return myJobs;
    return myJobs.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        (job.location ?? '').toLowerCase().includes(q)
    );
  }, [myJobs, query]);

  const selectedJob = useMemo(
    () => myJobs.find((job) => job.id === selectedJobId) ?? null,
    [myJobs, selectedJobId]
  );

  if (role !== 'field_super') return <AccessDenied />;

  const jobcardCountFor = (jobId: string) =>
    jobcards.filter((c) => c.jobId === jobId).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHint}>
          A card for every job — open one for its full dashboard: address,
          flashing material, jobcards, issues, documents, and pictures.
        </Text>

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

        {myJobs.length === 0 ? (
          <Text style={styles.emptyText}>
            No jobs assigned to you yet — the Operator assigns Field Supers to
            jobs.
          </Text>
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

      <JobDashboardSidebar
        job={selectedJob}
        onClose={() => setSelectedJobId(null)}
        editable
        quickViewJobs={myJobs}
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
