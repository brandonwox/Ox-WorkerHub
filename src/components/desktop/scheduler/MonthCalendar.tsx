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
  /** The crew a placed card is assigned to (the assign target). */
  activeCrew: Crew | null;
  /** Assignments already filtered to the visible (toggled-on) crews. */
  visibleAssignments: ScheduleAssignment[];
  jobcards: Jobcard[];
  /** Distinct color for a crew id, used to tint that crew's cards. */
  colorForCrew: (crewId: string) => string;
  /** Dates a Daily Crew pulls one of the active crew's members away (yyyy-MM-dd). */
  overrideDates: Set<string>;
  /** Dates a member would be double-booked across crews (yyyy-MM-dd). */
  doubleBookedDates: Set<string>;
  /** True when a backlog card is selected and waiting to be placed. */
  placing: boolean;
  onAssignToDate: (date: string) => void;
  onUnassign: (assignmentId: string) => void;
}

/** Month grid showing the visible crews' assignments per day, colored by crew. */
export function MonthCalendar({
  month,
  onPrevMonth,
  onNextMonth,
  activeCrew,
  visibleAssignments,
  jobcards,
  colorForCrew,
  overrideDates,
  doubleBookedDates,
  placing,
  onAssignToDate,
  onUnassign,
}: Props) {
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart); // 0 (Sun) … 6 (Sat)

  const cardById = (id: string) => jobcards.find((c) => c.id === id);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.monthLabel}>{format(month, 'MMMM yyyy')}</Text>
          <Text style={styles.viewing}>
            {activeCrew
              ? `Assigning to ${activeCrew.name}`
              : 'No active crew — tap one to assign'}
          </Text>
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
        <View style={styles.placingBanner}>
          <Feather name="crosshair" size={14} color={colors.primary} />
          <Text style={styles.placingText}>
            Click a day to assign the selected jobcard
            {activeCrew ? ` to ${activeCrew.name}` : ''}.
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
          const isOverride = overrideDates.has(dateStr);
          const isConflict = doubleBookedDates.has(dateStr);

          return (
            <Pressable
              key={dateStr}
              style={[
                styles.cell,
                isConflict && styles.cellConflict,
                placing && styles.cellPlacing,
              ]}
              onPress={placing ? () => onAssignToDate(dateStr) : undefined}
            >
              <View style={styles.cellHead}>
                <Text
                  style={[styles.dayNum, isToday(dayDate) && styles.dayNumToday]}
                >
                  {format(dayDate, 'd')}
                </Text>
                {isOverride && (
                  <View style={styles.overrideChip}>
                    <Text style={styles.overrideText}>Daily</Text>
                  </View>
                )}
              </View>

              <View style={styles.cellCards}>
                {dayAssignments.map((a) => {
                  const card = cardById(a.jobcardId);
                  if (!card) return null;
                  const crewColor = colorForCrew(a.crewId);
                  return (
                    <View
                      key={a.id}
                      style={[
                        styles.placed,
                        {
                          backgroundColor: withAlpha(crewColor, 0.18),
                          borderColor: withAlpha(crewColor, 0.55),
                        },
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
                      <Pressable
                        onPress={() => onUnassign(a.id)}
                        hitSlop={6}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Feather name="x" size={12} color={colors.textTertiary} />
                      </Pressable>
                    </View>
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
    color: colors.primary,
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
    backgroundColor: colors.primaryDim,
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
    minHeight: 92,
  },
  cell: {
    width: '14.2857%',
    minHeight: 92,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.sm,
  },
  cellConflict: {
    borderColor: colors.warning,
    backgroundColor: colors.warningDim,
  },
  cellPlacing: {
    borderColor: colors.border,
    borderStyle: 'dashed',
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
  overrideChip: {
    backgroundColor: colors.warningDim,
    borderRadius: radii.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  overrideText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
});
