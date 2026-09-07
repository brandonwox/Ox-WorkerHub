import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { archivedJobs } from '@/utils/jobArchive';
import { jobDisplayName } from '@/utils/jobName';

/**
 * The Archived section at the bottom of the phone Jobs tab — the mobile port
 * of the web ArchivedJobsSection. Every archived job the tab covers sits
 * collapsed behind a header; each row offers Restore (back to active,
 * sub-jobs included) and a two-tap permanent delete. Sub-jobs archived WITH
 * their parent don't get their own row (the parent's covers the family); a
 * sub-job archived alone does.
 *
 * Gating: Restore is open to any Field Super (an archive flag is a plain job
 * edit). Delete forever shows only on jobs the viewer is ASSIGNED to — the
 * jobs_delete RLS policy rejects anyone else, so there's no point offering it.
 */
export function ArchivedJobsMobile({
  /**
   * With the tab's "All jobs" toggle off, only archived jobs the viewer is
   * assigned to are listed; on, every archived job.
   */
  showAll,
}: {
  showAll: boolean;
}) {
  const me = useCurrentWorker();
  const jobs = useAppStore((s) => s.jobs);
  const restoreJob = useAppStore((s) => s.restoreJob);
  const removeJob = useAppStore((s) => s.removeJob);
  const flash = useAppStore((s) => s.flash);
  const [open, setOpen] = useState(false);
  // Two-tap permanent delete: the armed row's Delete turns into a confirm and
  // disarms on its own after a beat.
  const [armedId, setArmedId] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    []
  );

  const meId = me?.id;
  const isAssigned = (job: { fieldSuperIds?: string[] }) =>
    !!meId && (job.fieldSuperIds ?? []).includes(meId);

  const rows = useMemo(
    () =>
      archivedJobs(jobs).filter(
        (j) =>
          (!j.parentJobId ||
            !jobs.find((p) => p.id === j.parentJobId)?.archivedAt) &&
          (showAll || (!!meId && (j.fieldSuperIds ?? []).includes(meId)))
      ),
    [jobs, showAll, meId]
  );

  if (rows.length === 0) return null;

  const armDelete = (id: string) => {
    setArmedId(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmedId(null), 4000);
  };

  return (
    <View style={styles.section}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={() => setOpen((o) => !o)}
      >
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={colors.textSecondary}
        />
        <Feather name="archive" size={14} color={colors.textSecondary} />
        <Text style={styles.headerText}>Archived ({rows.length})</Text>
      </Pressable>

      {open &&
        rows.map((job) => {
          const subCount = jobs.filter(
            (j) => j.parentJobId === job.id && j.archivedAt
          ).length;
          const armed = armedId === job.id;
          const canDelete = isAssigned(job);
          return (
            <View key={job.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {jobDisplayName(job, jobs)}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[
                    job.po,
                    job.archivedAt
                      ? `archived ${format(parseISO(job.archivedAt), 'MMM d')}`
                      : '',
                    subCount > 0
                      ? `${subCount} ${subCount === 1 ? 'sub-job' : 'sub-jobs'}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={styles.rowActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.restoreButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    restoreJob(job.id);
                    flash(`Job "${job.name}" restored`, 'success');
                  }}
                >
                  <Feather name="rotate-ccw" size={13} color={colors.primary} />
                  <Text style={styles.restoreText}>Restore</Text>
                </Pressable>
                {canDelete && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      armed && styles.deleteButtonArmed,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      if (!armed) {
                        armDelete(job.id);
                        return;
                      }
                      setArmedId(null);
                      removeJob(job.id);
                      flash(`Job "${job.name}" permanently deleted`, 'success');
                    }}
                  >
                    <Feather
                      name="trash-2"
                      size={13}
                      color={armed ? colors.textOnAccent : colors.danger}
                    />
                    <Text
                      style={[styles.deleteText, armed && styles.deleteTextArmed]}
                    >
                      {armed ? 'Tap again to delete forever' : 'Delete'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    section: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    headerText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      opacity: 0.85,
    },
    rowText: {
      gap: 2,
    },
    rowName: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    rowMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    // Buttons wrap under the text — a phone row is too narrow for the web's
    // single-line layout once the armed "Tap again…" label appears.
    rowActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    restoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    restoreText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    deleteButtonArmed: {
      backgroundColor: colors.danger,
    },
    deleteText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    deleteTextArmed: {
      color: colors.textOnAccent,
    },
  })
);
