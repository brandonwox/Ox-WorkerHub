import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { jobDisplayName } from '@/utils/jobName';
import { formatMoney } from '@/utils/time';

/**
 * The Finance Manager's Jobs screen (desktop page + mobile home tab): every
 * job with its QBT jobcode id and labor budget (both editable inline) and how
 * much of the budget has been paid out in wages (summed timesheet earnings on
 * the job's jobcards). A warning banner counts jobs still missing a jobcode —
 * mapping them is the Finance Manager's responsibility.
 */
export function FinanceJobs() {
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const logs = useAppStore((s) => s.logs);
  const updateJob = useAppStore((s) => s.updateJob);

  // Sub-jobs need their own QBT jobcode/budget, so they list like any job —
  // sorted and shown under their conjoined name ("Vista Homes Lot 2").
  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((a, b) =>
        a.status === b.status
          ? jobDisplayName(a, jobs).localeCompare(jobDisplayName(b, jobs))
          : a.status === 'Active'
            ? -1
            : 1
      ),
    [jobs]
  );

  const unmappedCount = useMemo(
    () => jobs.filter((job) => !job.qbtJobcodeId).length,
    [jobs]
  );

  // Wages paid out per job: earnings of every timesheet logged on the job's
  // jobcards (custom-project hours belong to no job and stay out).
  const paidByJob = useMemo(() => {
    const jobByCard = new Map<string, string>();
    for (const card of jobcards) {
      if (card.jobId) jobByCard.set(card.id, card.jobId);
    }
    const paid = new Map<string, number>();
    for (const log of logs) {
      if (!log.jobcardId) continue;
      const jobId = jobByCard.get(log.jobcardId);
      if (!jobId) continue;
      paid.set(jobId, (paid.get(jobId) ?? 0) + log.earnedAmount);
    }
    return paid;
  }, [jobcards, logs]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {unmappedCount > 0 && (
          <View style={styles.warningBanner}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              {unmappedCount} {unmappedCount === 1 ? 'job is' : 'jobs are'}{' '}
              missing a QuickBooks Time jobcode ID — hours on those jobs
              can&apos;t sync to payroll until one is set.
            </Text>
          </View>
        )}

        {sortedJobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs yet.</Text>
        ) : (
          sortedJobs.map((job) => (
            <FinanceJobCard
              key={job.id}
              job={job}
              displayName={jobDisplayName(job, jobs)}
              paidOut={paidByJob.get(job.id) ?? 0}
              onCommitJobcode={(qbtJobcodeId) =>
                updateJob(job.id, { qbtJobcodeId })
              }
              onCommitBudget={(laborBudget) =>
                updateJob(job.id, { laborBudget })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FinanceJobCard({
  job,
  displayName,
  paidOut,
  onCommitJobcode,
  onCommitBudget,
}: {
  job: Job;
  /** Conjoined for sub-jobs ("Vista Homes Lot 2"); the plain name otherwise. */
  displayName: string;
  paidOut: number;
  onCommitJobcode: (value: string | undefined) => void;
  onCommitBudget: (value: number | undefined) => void;
}) {
  const budget = job.laborBudget;
  const overBudget = budget != null && budget > 0 && paidOut > budget;
  const ratio =
    budget != null && budget > 0 ? Math.min(1, paidOut / budget) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.jobName} numberOfLines={1}>
          {displayName}
        </Text>
        {job.status === 'Finished' && (
          <View style={styles.archivedPill}>
            <Text style={styles.archivedText}>Finished</Text>
          </View>
        )}
      </View>

      <View style={styles.fieldsRow}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>QBT jobcode ID</Text>
          <JobcodeInput
            key={`code-${job.id}`}
            value={job.qbtJobcodeId ?? ''}
            missing={!job.qbtJobcodeId}
            onCommit={onCommitJobcode}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Labor budget</Text>
          <BudgetInput
            key={`budget-${job.id}`}
            value={budget}
            onCommit={onCommitBudget}
          />
        </View>
      </View>

      <View style={styles.paidBlock}>
        <View style={styles.paidRow}>
          <Text style={styles.paidLabel}>Paid out</Text>
          <Text style={[styles.paidValue, overBudget && styles.paidOver]}>
            {formatMoney(paidOut)}
            {budget != null && budget > 0 && (
              <Text style={styles.paidOf}> of {formatMoney(budget)}</Text>
            )}
          </Text>
        </View>
        {budget != null && budget > 0 ? (
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${ratio * 100}%` },
                overBudget && styles.barOver,
              ]}
            />
          </View>
        ) : (
          <Text style={styles.noBudget}>No labor budget set.</Text>
        )}
      </View>
    </View>
  );
}

/** Inline QBT jobcode editor; commits on blur (empty clears the mapping). */
function JobcodeInput({
  value,
  missing,
  onCommit,
}: {
  value: string;
  missing: boolean;
  onCommit: (next: string | undefined) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed || undefined);
  };
  return (
    <TextInput
      style={[styles.input, missing && !text.trim() && styles.inputMissing]}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="not set"
      placeholderTextColor={colors.warning}
    />
  );
}

/** Inline labor budget editor (dollars); commits on blur (empty clears). */
function BudgetInput({
  value,
  onCommit,
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
}) {
  const [text, setText] = useState(value != null ? String(value) : '');
  const commit = () => {
    const trimmed = text.trim().replace(/[$,\s]/g, '');
    if (!trimmed) {
      onCommit(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
    else setText(value != null ? String(value) : '');
  };
  return (
    <TextInput
      style={styles.input}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="$0"
      placeholderTextColor={colors.textTertiary}
      keyboardType="decimal-pad"
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.warningDim,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    warningText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 19,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    jobName: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 16,
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
    fieldsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
    },
    field: {
      flexGrow: 1,
      flexBasis: 180,
      gap: spacing.xs,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
      outlineWidth: 0,
    },
    inputMissing: {
      borderColor: colors.warning,
    },
    paidBlock: {
      gap: spacing.xs + 2,
    },
    paidRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    paidLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
    },
    paidValue: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
    },
    paidOver: {
      color: colors.danger,
    },
    paidOf: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
    },
    barTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceLight,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    barOver: {
      backgroundColor: colors.danger,
    },
    noBudget: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
  })
);
