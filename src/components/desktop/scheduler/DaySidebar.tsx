import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard, ScheduleAssignment } from '@/types';
import { withAlpha } from '@/utils/crewColors';
import { priorityColor } from '@/utils/priority';

interface Props {
  /** The day being viewed (yyyy-MM-dd). */
  date: string;
  /** Assignments for `date`, already filtered to the visible crews. */
  assignments: ScheduleAssignment[];
  jobcards: Jobcard[];
  jobNameFor: (jobId?: string) => string;
  colorForCrew: (crewId: string) => string;
  /** Crew display name (a single letter). */
  crewNameFor: (crewId: string) => string;
  onOpenCard: (jobcardId: string) => void;
  onClose: () => void;
}

/**
 * A day's schedule, opened by clicking that day in the month calendar. Sits
 * between the calendar and the Work Requests column; clicking a jobcard on the
 * main calendar closes it.
 */
export function DaySidebar({
  date,
  assignments,
  jobcards,
  jobNameFor,
  colorForCrew,
  crewNameFor,
  onOpenCard,
  onClose,
}: Props) {
  // One row per jobcard even when several visible crews share it — the crew
  // letters on the row say who it belongs to (same grouping as the calendar).
  const dayCards: { card: Jobcard; group: ScheduleAssignment[] }[] = [];
  for (const a of assignments) {
    const entry = dayCards.find((e) => e.card.id === a.jobcardId);
    if (entry) {
      entry.group.push(a);
      continue;
    }
    const card = jobcards.find((c) => c.id === a.jobcardId);
    if (card) dayCards.push({ card, group: [a] });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {format(parseISO(date), 'EEEE')}
          </Text>
          <Text style={styles.subtitle}>
            {format(parseISO(date), 'MMMM d, yyyy')}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          onPress={onClose}
          hitSlop={8}
        >
          <Feather name="x" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {dayCards.length === 0 ? (
          <Text style={styles.emptyText}>Nothing scheduled this day.</Text>
        ) : (
          dayCards.map(({ card, group }) => {
            const crewColor = colorForCrew(group[0].crewId);
            return (
              <Pressable
                key={card.id}
                onPress={() => onOpenCard(card.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: withAlpha(crewColor, 0.14),
                    borderColor: withAlpha(crewColor, 0.5),
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: priorityColor(card.priority) },
                  ]}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {card.title}
                  </Text>
                  <Text style={styles.rowJob} numberOfLines={1}>
                    {jobNameFor(card.jobId)}
                  </Text>
                </View>
                <Text style={styles.rowCrews}>
                  {group.map((a, i) => (
                    <Text key={a.id} style={{ color: colorForCrew(a.crewId) }}>
                      {i > 0 ? ' ' : ''}
                      {crewNameFor(a.crewId)}
                    </Text>
                  ))}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  rowJob: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  rowCrews: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
