import { Feather } from '@expo/vector-icons';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  startOfMonth,
} from 'date-fns';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { Crew, Jobcard, ScheduleAssignment } from '@/types';
import { withAlpha } from '@/utils/crewColors';
import { priorityColor } from '@/utils/priority';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  month: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** The crews a placed card is assigned to (the assign targets). */
  activeCrews: Crew[];
  /** Assignments already filtered to the visible (toggled-on) crews. */
  visibleAssignments: ScheduleAssignment[];
  jobcards: Jobcard[];
  /** Distinct color for a crew id, used to tint that crew's cards. */
  colorForCrew: (crewId: string) => string;
  /** True when a work request is selected and waiting to be placed. */
  placing: boolean;
  onAssignToDate: (date: string) => void;
  onUnassign: (assignmentId: string) => void;
  /** Open a day's schedule (the sidebar). Fires only when not placing. */
  onOpenDay?: (date: string) => void;
  /** Open a placed jobcard (same quick view the Jobcards pages use). */
  onOpenCard: (jobcardId: string) => void;
  /** Whether placed cards can be removed from the calendar (Scheduler only). */
  canUnassign?: boolean;
  /**
   * Whether the viewer assigns work. Field Supers only look at the calendar,
   * so the "Assigning to …" header line is hidden for them.
   */
  canAssign?: boolean;
  /** Crew display name (a single letter) for the multi-crew tags on cards. */
  crewNameFor: (crewId: string) => string;
}

/** Month grid showing the visible crews' assignments per day, colored by crew. */
export function MonthCalendar({
  month,
  onPrevMonth,
  onNextMonth,
  activeCrews,
  visibleAssignments,
  jobcards,
  colorForCrew,
  placing,
  onAssignToDate,
  onUnassign,
  onOpenDay,
  onOpenCard,
  canUnassign = true,
  canAssign = true,
  crewNameFor,
}: Props) {
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart); // 0 (Sun) … 6 (Sat)

  // Placing cues take on the active crew's color when there's a single target;
  // with several (multi-assign) or none they stay neutral grey — the crew names
  // themselves are always rendered in their own colors.
  const activeColor =
    activeCrews.length === 1
      ? colorForCrew(activeCrews[0].id)
      : colors.textSecondary;

  // The active crew names as inline, per-crew-colored spans for use inside a
  // parent <Text> (e.g. "Assigning to Alpha, Bravo").
  const crewNameSpans = activeCrews.map((c, i) => (
    <Text key={c.id} style={{ color: colorForCrew(c.id) }}>
      {c.name}
      {i < activeCrews.length - 1 ? ', ' : ''}
    </Text>
  ));

  const cardById = (id: string) => jobcards.find((c) => c.id === id);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.monthLabel}>{format(month, 'MMMM yyyy')}</Text>
          {canAssign && (
            <Text style={styles.viewing}>
              {activeCrews.length > 0 ? (
                <>Assigning to {crewNameSpans}</>
              ) : (
                'No active crew — tap one to assign'
              )}
            </Text>
          )}
        </View>
        <View style={styles.navBtns}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={onPrevMonth}
            hitSlop={6}
          >
            <Feather name="chevron-left" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={onNextMonth}
            hitSlop={6}
          >
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {placing && (
        <View style={[styles.placingBanner, { backgroundColor: withAlpha(activeColor, 0.18) }]}>
          <Feather name="crosshair" size={14} color={activeColor} />
          <Text style={styles.placingText}>
            Click a day to assign the selected jobcard
            {activeCrews.length > 0 ? <> to {crewNameSpans}</> : ''}.
          </Text>
        </View>
      )}

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={styles.cellBlank} />
        ))}

        {days.map((dayDate) => {
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          const dayAssignments = visibleAssignments.filter(
            (a) => a.date === dateStr
          );
          // One chip per jobcard even when several visible crews share it —
          // the crew letters on the end of the chip say who it belongs to.
          const dayCards: { card: Jobcard; group: ScheduleAssignment[] }[] = [];
          for (const a of dayAssignments) {
            const entry = dayCards.find((e) => e.card.id === a.jobcardId);
            if (entry) {
              entry.group.push(a);
              continue;
            }
            const card = cardById(a.jobcardId);
            if (card) dayCards.push({ card, group: [a] });
          }

          return (
            <Pressable
              key={dateStr}
              style={styles.cell}
              onPress={
                placing
                  ? () => onAssignToDate(dateStr)
                  : onOpenDay
                    ? () => onOpenDay(dateStr)
                    : undefined
              }
            >
              <View style={styles.cellHead}>
                <Text
                  style={[styles.dayNum, isToday(dayDate) && styles.dayNumToday]}
                >
                  {format(dayDate, 'd')}
                </Text>
              </View>

              <View style={styles.cellCards}>
                {dayCards.map(({ card, group }) => {
                  const crewColor = colorForCrew(group[0].crewId);
                  return (
                    <Pressable
                      key={card.id}
                      onPress={
                        placing
                          ? () => onAssignToDate(dateStr)
                          : () => onOpenCard(card.id)
                      }
                      style={({ pressed }) => [
                        styles.placed,
                        {
                          backgroundColor: withAlpha(crewColor, 0.18),
                          borderColor: withAlpha(crewColor, 0.55),
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.placedDot,
                          { backgroundColor: priorityColor(card.priority) },
                        ]}
                      />
                      <Text style={styles.placedTitle} numberOfLines={1}>
                        {card.title}
                      </Text>
                      {group.length > 1 && (
                        <Text style={styles.placedCrews} numberOfLines={1}>
                          {group.map((a, i) => (
                            <Text
                              key={a.id}
                              style={{ color: colorForCrew(a.crewId) }}
                            >
                              {i > 0 ? ' ' : ''}
                              {crewNameFor(a.crewId)}
                            </Text>
                          ))}
                        </Text>
                      )}
                      {canUnassign && (
                        <Pressable
                          // Unassigning a shared card removes it from every
                          // crew (the handler fans out from any assignment).
                          onPress={() => onUnassign(group[0].id)}
                          hitSlop={6}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <Feather
                            name="x"
                            size={12}
                            color={colors.textTertiary}
                          />
                        </Pressable>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  viewing: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  navBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  placingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Neutral fallback — the inline style tints it with the active crew's
    // color (grey when several crews are targeted).
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  placingText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  cellBlank: {
    width: '14.2857%',
    minHeight: 116,
  },
  cell: {
    width: '14.2857%',
    minHeight: 116,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  cellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNum: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  dayNumToday: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
  },
  cellCards: {
    gap: 3,
    marginTop: 3,
  },
  placed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  placedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  placedTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  placedCrews: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
