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
import { JobJobcardsModal } from '@/components/desktop/JobJobcardsModal';
import { JobPhotosModal } from '@/components/desktop/JobPhotosModal';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { jobAllowsWindows } from '@/utils/jobScopes';

/** Field Super → Jobs: a card per job; open one to edit its flashing material. */
export default function FieldSuperJobsScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const assignments = useAppStore((s) => s.assignments);
  const updateJob = useAppStore((s) => s.updateJob);

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [photosJob, setPhotosJob] = useState<Job | null>(null);

  // A Field Super sees ONLY the jobs they're assigned to, Active first.
  const sortedJobs = useMemo(
    () =>
      (me ? jobsForFieldSuper(jobs, me.id) : []).sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'Active' ? -1 : 1
      ),
    [jobs, me]
  );

  // "On the calendar" = the jobcard has a row in `assignments`.
  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.jobcardId)),
    [assignments]
  );

  if (role !== 'field_super') return <AccessDenied />;

  const jobcardCountFor = (jobId: string) =>
    jobcards.filter((c) => c.jobId === jobId).length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHint}>
          A card for every job. Open one to set its Window Opening Flashing
          Material — new window jobcards inherit it automatically.
        </Text>

        {sortedJobs.length === 0 ? (
          <Text style={styles.emptyText}>
            No jobs assigned to you yet — the Operator assigns Field Supers to
            jobs.
          </Text>
        ) : (
          <View style={styles.cardStack}>
            {sortedJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                jobcardCount={jobcardCountFor(job.id)}
                expanded={expandedJobId === job.id}
                onToggle={() =>
                  setExpandedJobId((id) => (id === job.id ? null : job.id))
                }
                onViewJobcards={() => setViewJob(job)}
                onViewPhotos={() => setPhotosJob(job)}
                onCommitLocation={(location) =>
                  updateJob(job.id, { location })
                }
                onCommitFlashing={(flashingMaterial) =>
                  updateJob(job.id, { flashingMaterial })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      <JobJobcardsModal
        job={viewJob}
        jobcards={jobcards}
        scheduledIds={scheduledIds}
        onClose={() => setViewJob(null)}
      />

      <JobPhotosModal job={photosJob} onClose={() => setPhotosJob(null)} />
    </View>
  );
}

/** A job as an expandable card; expanded reveals the editable flashing field. */
function JobRow({
  job,
  jobcardCount,
  expanded,
  onToggle,
  onViewJobcards,
  onViewPhotos,
  onCommitLocation,
  onCommitFlashing,
}: {
  job: Job;
  jobcardCount: number;
  expanded: boolean;
  onToggle: () => void;
  onViewJobcards: () => void;
  onViewPhotos: () => void;
  onCommitLocation: (value: string) => void;
  onCommitFlashing: (value: string | undefined) => void;
}) {
  return (
    <View style={styles.jobCard}>
      <Pressable style={styles.jobCardHead} onPress={onToggle}>
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
        {/* Nested Pressable: opens the popup without toggling the flashing row. */}
        <Pressable
          style={({ pressed }) => [
            styles.viewButton,
            pressed && styles.viewButtonPressed,
          ]}
          onPress={onViewJobcards}
        >
          <Feather name="clipboard" size={14} color={colors.primary} />
          <Text style={styles.viewButtonText}>
            {jobcardCount} {jobcardCount === 1 ? 'jobcard' : 'jobcards'}
          </Text>
        </Pressable>
        {/* Nested Pressable: opens the job's photo wall. */}
        <Pressable
          style={({ pressed }) => [
            styles.viewButton,
            pressed && styles.viewButtonPressed,
          ]}
          onPress={onViewPhotos}
        >
          <Feather name="image" size={14} color={colors.primary} />
          <Text style={styles.viewButtonText}>Pics</Text>
        </Pressable>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.jobCardBody}>
          <Text style={styles.fieldLabel}>Jobsite address</Text>
          <AddressCell job={job} onCommit={onCommitLocation} />

          {/* Hidden entirely for jobs whose scopes exclude window work. */}
          {jobAllowsWindows(job) && (
            <>
              <Text style={styles.fieldLabel}>
                Window Opening Flashing Material
              </Text>
              <View style={styles.flashRow}>
                <FlashingCell job={job} onCommit={onCommitFlashing} />
                <FlashingPhotoField job={job} editable />
              </View>
              <Text style={styles.fieldHint}>
                New jobcards with the Windows scope inherit this value (editable
                per card). The photo shows on every jobcard of this job.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** Inline editable jobsite address; commits on blur. */
function AddressCell({
  job,
  onCommit,
}: {
  job: Job;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(job.location ?? '');

  const commit = () => onCommit(text.trim());

  return (
    <View style={styles.flashWrap}>
      <TextInput
        style={styles.flashInput}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onEndEditing={commit}
        placeholder="123 Main St, Park City, UT"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

/** Inline editable Window Opening Flashing Material; commits on blur. */
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

  return (
    <View style={styles.flashWrap}>
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
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  cardStack: {
    gap: spacing.sm,
  },
  jobCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  jobCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  viewButtonPressed: {
    opacity: 0.85,
  },
  viewButtonText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
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
  jobCardBody: {
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  fieldHint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  flashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  flashWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  flashInput: {
    minWidth: 220,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    outlineWidth: 0,
  },
}));
