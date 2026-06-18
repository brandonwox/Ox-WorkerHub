import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JobcardRow } from '@/components/desktop/JobcardRow';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job, Jobcard } from '@/types';

interface Props {
  /** The job whose jobcards to show, or null when closed. */
  job: Job | null;
  /** All jobcards (filtered to this job internally). */
  jobcards: Jobcard[];
  /** Ids of jobcards the Scheduler has placed on the calendar. */
  scheduledIds: Set<string>;
  onClose: () => void;
}

/** Large popup listing every jobcard belonging to a single job. */
export function JobJobcardsModal({ job, jobcards, scheduledIds, onClose }: Props) {
  const cards = useMemo(
    () => (job ? jobcards.filter((c) => c.jobId === job.id) : []),
    [job, jobcards]
  );

  return (
    <Modal
      visible={!!job}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerMain}>
              <Text style={styles.title} numberOfLines={1}>
                {job?.name ?? ''}
              </Text>
              <Text style={styles.subtitle}>
                {cards.length} {cards.length === 1 ? 'jobcard' : 'jobcards'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {cards.length === 0 ? (
            <Text style={styles.empty}>No jobcards for this job yet.</Text>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.list}
            >
              {cards.map((card) => (
                <JobcardRow
                  key={card.id}
                  jobcard={card}
                  jobName={job?.name ?? ''}
                  scheduled={scheduledIds.has(card.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerMain: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  scroll: {
    flexShrink: 1,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 14,
    paddingVertical: spacing.lg,
  },
});
