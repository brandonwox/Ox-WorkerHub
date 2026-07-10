import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/FormInput';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { jobsForFieldSuper, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job } from '@/types';

/**
 * The Field Super's jobs on the phone. Mirrors the desktop page's scope: tap a
 * job to expand it and update the jobsite address and flashing material.
 */
export function FieldSuperJobsMobile() {
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const assignments = useAppStore((s) => s.assignments);
  const updateJob = useAppStore((s) => s.updateJob);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const myJobs = useMemo(
    () => (me ? jobsForFieldSuper(jobs, me.id) : []),
    [jobs, me]
  );

  const scheduledIds = useMemo(
    () => new Set(assignments.map((a) => a.jobcardId)),
    [assignments]
  );

  const countsFor = (job: Job) => {
    const cards = jobcards.filter((c) => c.jobId === job.id);
    const scheduled = cards.filter((c) => scheduledIds.has(c.id)).length;
    return { total: cards.length, scheduled };
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.heading}>Jobs</Text>
        <Text style={styles.hint}>
          Tap a job to update its address and flashing material.
        </Text>

        <ScrollView contentContainerStyle={styles.listContent}>
          {myJobs.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="briefcase" size={32} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No jobs</Text>
              <Text style={styles.emptySubtitle}>
                Jobs the Operator assigns to you show up here.
              </Text>
            </View>
          ) : (
            myJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                counts={countsFor(job)}
                expanded={expandedId === job.id}
                onToggle={() =>
                  setExpandedId((id) => (id === job.id ? null : job.id))
                }
                onSave={(changes) => updateJob(job.id, changes)}
              />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function JobRow({
  job,
  counts,
  expanded,
  onToggle,
  onSave,
}: {
  job: Job;
  counts: { total: number; scheduled: number };
  expanded: boolean;
  onToggle: () => void;
  onSave: (changes: { location?: string; flashingMaterial?: string }) => void;
}) {
  const router = useRouter();
  const [location, setLocation] = useState(job.location);
  const [flashing, setFlashing] = useState(job.flashingMaterial ?? '');
  const [saved, setSaved] = useState(false);

  const dirty =
    location.trim() !== job.location ||
    flashing.trim() !== (job.flashingMaterial ?? '');

  const save = () => {
    onSave({ location: location.trim(), flashingMaterial: flashing.trim() });
    setSaved(true);
  };

  const archived = job.status === 'Archived';

  return (
    <View style={[styles.card, archived && styles.cardArchived]}>
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {job.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {counts.total} {counts.total === 1 ? 'jobcard' : 'jobcards'} ·{' '}
            {counts.scheduled} on calendar
            {archived ? ' · Archived' : ''}
          </Text>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.cardBody}>
          <FormInput
            label="Jobsite address"
            value={location}
            onChangeText={(text) => {
              setLocation(text);
              setSaved(false);
            }}
            placeholder="Street, city"
          />
          <FormInput
            label="Flashing material"
            value={flashing}
            onChangeText={(text) => {
              setFlashing(text);
              setSaved(false);
            }}
            placeholder="e.g. Dark bronze aluminum"
          />
          <FlashingPhotoField job={job} editable />
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!dirty || pressed) && styles.saveDim,
            ]}
            onPress={save}
            disabled={!dirty}
          >
            <Text style={styles.saveText}>
              {saved && !dirty ? 'Saved ✓' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.picsButton,
              pressed && styles.saveDim,
            ]}
            onPress={() =>
              router.push({ pathname: '/job-site/[id]', params: { id: job.id } })
            }
          >
            <Feather name="image" size={15} color={colors.primary} />
            <Text style={styles.picsText}>Job pics</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardArchived: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  cardSub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveDim: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  picsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
  },
  picsText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 14,
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
  },
});
